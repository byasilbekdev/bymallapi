import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

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

  async revokeRefreshToken(tokenId: string, ttlSeconds: number): Promise<void> {
    await this.client.set(this.revokedKey(tokenId), '1', 'EX', ttlSeconds);
  }

  async isRefreshTokenRevoked(tokenId: string): Promise<boolean> {
    const value = await this.client.get(this.revokedKey(tokenId));
    return value === '1';
  }

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
