import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Thin wrapper around ioredis, used as the fast revocation/session store
 * for refresh tokens. Postgres remains the source of truth (audit trail,
 * device list); Redis exists purely to make "is this token revoked?"
 * checks O(1) without hitting Postgres on every refresh call.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly config: ConfigService) {
    this.client = new Redis(this.config.get<string>('redis.url') ?? '', {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
      this.logger.log('Redis connected');
    } catch (error) {
      this.logger.error(
        'Redis connection failed',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  /** Mark a refresh token id as revoked, expiring automatically at token TTL. */
  async revokeRefreshToken(tokenId: string, ttlSeconds: number): Promise<void> {
    await this.client.set(this.revokedKey(tokenId), '1', 'EX', ttlSeconds);
  }

  async isRefreshTokenRevoked(tokenId: string): Promise<boolean> {
    const value = await this.client.get(this.revokedKey(tokenId));
    return value === '1';
  }

  /** Revoke every active refresh token for a user (e.g. on password reset / theft detection). */
  async revokeAllUserSessions(
    userId: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.client.set(
      this.userRevokedKey(userId),
      Date.now().toString(),
      'EX',
      ttlSeconds,
    );
  }

  /** Returns the epoch ms after which all of a user's tokens are considered invalid, if set. */
  async getUserRevocationTimestamp(userId: string): Promise<number | null> {
    const value = await this.client.get(this.userRevokedKey(userId));
    return value ? Number(value) : null;
  }

  private revokedKey(tokenId: string): string {
    return `revoked:refresh-token:${tokenId}`;
  }

  private userRevokedKey(userId: string): string {
    return `revoked:user:${userId}`;
  }
}
