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
    secure: isProd, // requires HTTPS in production
    sameSite: 'lax' as const, // 'strict' breaks OAuth redirect flows
    path: '/',
  };

  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseOptions,
    maxAge: 15 * 60 * 1000, // 15 minutes, keep in sync with JWT_ACCESS_EXPIRES_IN
  });

  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, keep in sync with JWT_REFRESH_EXPIRES_IN
    path: '/api/v1/auth', // only sent to auth endpoints, reduces exposure
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' });
}
