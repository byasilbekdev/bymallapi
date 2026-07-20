export interface JwtAccessPayload {
  sub: string; // userId
  email: string;
}

export interface JwtRefreshPayload {
  sub: string; // userId
  tokenId: string; // refresh token DB record id, used for rotation/revocation
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
