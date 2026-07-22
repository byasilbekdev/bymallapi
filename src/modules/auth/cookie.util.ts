import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './auth.types';

export function setAuthCookies(
  res: Response,
  config: ConfigService,
  tokens: { accessToken: string; refreshToken: string },
): void {
  const isProd = config.get<boolean>('app.isProduction');

  const baseOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
  };

  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseOptions,
    maxAge: 15 * 60 * 1000,
  });

  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' });
}
