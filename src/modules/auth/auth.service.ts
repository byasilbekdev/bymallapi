import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { User } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RedisService } from '../../database/redis.service';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { EmailVerificationRepository } from './repositories/email-verification.repository';
import { PasswordResetRepository } from './repositories/password-reset.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  AuthTokens,
  JwtAccessPayload,
  JwtRefreshPayload,
  RequestContext,
} from './auth.types';

const BCRYPT_SALT_ROUNDS = 12;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    private readonly redisService: RedisService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly emailVerificationRepository: EmailVerificationRepository,
    private readonly passwordResetRepository: PasswordResetRepository,
  ) {}

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      // Same generic error whether it's a taken email or an OAuth-only
      // account, to avoid leaking which emails are registered.
      throw new ConflictException("Bu email allaqachon ro'yxatdan o'tgan");
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const user = await this.usersService.createLocalUser({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phoneNumber: dto.phoneNumber,
    });

    await this.issueEmailVerificationToken(user);

    return {
      message:
        "Ro'yxatdan o'tish muvaffaqiyatli. Emailingizni tekshiring va tasdiqlang.",
    };
  }

  async validateLocalUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);

    // Always run bcrypt.compare even when user is missing/passwordless,
    // to keep response timing constant and avoid user-enumeration via timing.
    const hash = user?.password ?? '$2b$12$invalidsaltinvalidsaltinvalidsal';
    const isMatch = await bcrypt.compare(password, hash);

    if (!user || !user.password || !isMatch) {
      throw new UnauthorizedException("Email yoki parol noto'g'ri");
    }

    return user;
  }

  async login(
    dto: LoginDto,
    context: RequestContext,
  ): Promise<{ tokens: AuthTokens; user: User }> {
    const user = await this.validateLocalUser(dto.email, dto.password);
    const tokens = await this.issueTokenPair(user, context);
    return { tokens, user };
  }

  loginWithOAuthUser(user: User, context: RequestContext): Promise<AuthTokens> {
    return this.issueTokenPair(user, context);
  }

  /**
   * Rotates the refresh token: validates the presented token against Redis
   * (fast revocation check) and its stored hash in Postgres, revokes it,
   * and issues a brand-new pair. This limits the blast radius if a refresh
   * token is ever stolen (reuse detection below).
   */
  async refreshTokens(
    rawRefreshToken: string,
    context: RequestContext,
  ): Promise<AuthTokens> {
    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        rawRefreshToken,
        { secret: this.config.getOrThrow<string>('jwt.refreshSecret') },
      );
    } catch {
      throw new UnauthorizedException(
        "Refresh token yaroqsiz yoki muddati o'tgan",
      );
    }

    // Fast path: Redis revocation check (covers both single-token and
    // whole-user revocation) before touching Postgres.
    const isRevoked = await this.redisService.isRefreshTokenRevoked(
      payload.tokenId,
    );
    if (isRevoked) {
      await this.handleTokenReuse(payload.sub);
      throw new UnauthorizedException(
        'Xavfsizlik sababli barcha sessiyalar tugatildi. Qayta kiring.',
      );
    }

    const userRevokedAt = await this.redisService.getUserRevocationTimestamp(
      payload.sub,
    );

    const stored = await this.refreshTokenRepository.findById(payload.tokenId);
    if (!stored || stored.userId !== payload.sub) {
      throw new UnauthorizedException('Refresh token topilmadi');
    }

    if (
      stored.revoked ||
      (userRevokedAt !== null && stored.createdAt.getTime() < userRevokedAt)
    ) {
      // Reuse of a revoked token = possible theft. Revoke all sessions
      // for this user as a precaution.
      await this.handleTokenReuse(payload.sub);
      throw new UnauthorizedException(
        'Xavfsizlik sababli barcha sessiyalar tugatildi. Qayta kiring.',
      );
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token muddati o'tgan");
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    if (tokenHash !== stored.tokenHash) {
      throw new UnauthorizedException('Refresh token yaroqsiz');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Foydalanuvchi topilmadi');
    }

    // Revoke old, issue new (rotation) — Postgres for audit trail, Redis
    // for immediate effect on the fast path above.
    const remainingTtlSeconds = Math.max(
      1,
      Math.floor((stored.expiresAt.getTime() - Date.now()) / 1000),
    );
    await Promise.all([
      this.refreshTokenRepository.revoke(stored.id),
      this.redisService.revokeRefreshToken(stored.id, remainingTtlSeconds),
    ]);

    return this.issueTokenPair(user, context);
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;

    try {
      const payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(
        rawRefreshToken,
        { secret: this.config.getOrThrow<string>('jwt.refreshSecret') },
      );

      const stored = await this.refreshTokenRepository.findById(
        payload.tokenId,
      );
      if (!stored) return;

      const remainingTtlSeconds = Math.max(
        1,
        Math.floor((stored.expiresAt.getTime() - Date.now()) / 1000),
      );

      await Promise.all([
        this.refreshTokenRepository.revoke(payload.tokenId),
        this.redisService.revokeRefreshToken(
          payload.tokenId,
          remainingTtlSeconds,
        ),
      ]);
    } catch {
      // Token already invalid/expired — nothing to revoke, fail silently.
    }
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const record = await this.emailVerificationRepository.findByToken(token);

    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException(
        "Tasdiqlash havolasi yaroqsiz yoki muddati o'tgan",
      );
    }

    await this.usersService.markEmailVerified(record.userId);
    await this.emailVerificationRepository.delete(record.id);

    return { message: 'Email muvaffaqiyatli tasdiqlandi' };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);

    // Always return the same message — don't reveal whether the email exists.
    const genericResponse = {
      message:
        "Agar bu email ro'yxatdan o'tgan bo'lsa, parolni tiklash havolasi yuborildi",
    };

    if (!user || !user.password) {
      return genericResponse;
    }

    const token = crypto.randomBytes(32).toString('hex');
    await this.passwordResetRepository.create(
      user.id,
      token,
      new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    );

    await this.mailService.sendPasswordResetEmail(user.email, token);

    return genericResponse;
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const record = await this.passwordResetRepository.findByToken(token);

    if (!record || record.used || record.expiresAt < new Date()) {
      throw new UnauthorizedException(
        "Tiklash havolasi yaroqsiz yoki muddati o'tgan",
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    await this.usersService.updatePassword(record.userId, passwordHash);
    await this.passwordResetRepository.markUsed(record.id);

    // Invalidate all existing sessions after password change —
    // Redis for immediate effect, Postgres for audit trail.
    const refreshTtlSeconds = Math.floor(
      this.parseExpiryToMs(
        this.config.get<string>('jwt.refreshExpiresIn') ?? '7d',
      ) / 1000,
    );
    await Promise.all([
      this.refreshTokenRepository.revokeAllForUser(record.userId),
      this.redisService.revokeAllUserSessions(record.userId, refreshTtlSeconds),
    ]);

    return { message: 'Parol muvaffaqiyatli yangilandi' };
  }

  // ---------- private helpers ----------

  private async handleTokenReuse(userId: string): Promise<void> {
    const refreshTtlSeconds = Math.floor(
      this.parseExpiryToMs(
        this.config.get<string>('jwt.refreshExpiresIn') ?? '7d',
      ) / 1000,
    );
    await Promise.all([
      this.refreshTokenRepository.revokeAllForUser(userId),
      this.redisService.revokeAllUserSessions(userId, refreshTtlSeconds),
    ]);
    this.logger.warn(
      `Refresh token reuse detected for user ${userId}. All sessions revoked.`,
    );
  }

  private async issueTokenPair(
    user: User,
    context: RequestContext,
  ): Promise<AuthTokens> {
    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
    };
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      expiresIn: this.config.get<string>(
        'jwt.accessExpiresIn',
        '15m',
      ) as SignOptions['expiresIn'],
    });

    // Create the refresh-token DB row first so we have an id to embed
    // in the JWT (needed for rotation/revocation lookups).
    const refreshTtlMs = this.parseExpiryToMs(
      this.config.get<string>('jwt.refreshExpiresIn') ?? '7d',
    );
    const placeholderHash = crypto.randomBytes(16).toString('hex');

    const tokenRecord = await this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash: placeholderHash,
      expiresAt: new Date(Date.now() + refreshTtlMs),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    const refreshPayload: JwtRefreshPayload = {
      sub: user.id,
      tokenId: tokenRecord.id,
    };
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      expiresIn: this.config.get<string>(
        'jwt.refreshExpiresIn',
        '7d',
      ) as SignOptions['expiresIn'],
    });

    // Now store the real hash of the issued token.
    await this.refreshTokenRepository.updateTokenHash(
      tokenRecord.id,
      this.hashToken(refreshToken),
    );

    return { accessToken, refreshToken };
  }

  private async issueEmailVerificationToken(user: User): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex');
    await this.emailVerificationRepository.create(
      user.id,
      token,
      new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    );
    await this.mailService.sendVerificationEmail(user.email, token);
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseExpiryToMs(expiry: string): number {
    const match = /^(\d+)([smhd])$/.exec(expiry);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7d fallback

    const value = Number(match[1]);
    const unit = match[2];
    const unitMs: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return value * unitMs[unit];
  }
}
