export interface JwtAccessPayload {
  sub: string;
  email: string;
}

export interface JwtRefreshPayload {
  sub: string;
  tokenId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

export interface RequestUser {
  id: string;
  email: string;
}

export interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}
