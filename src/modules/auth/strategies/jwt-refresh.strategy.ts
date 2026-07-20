import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { REFRESH_TOKEN_COOKIE } from '../auth.types';
import type { JwtRefreshPayload } from '../auth.types';

export interface RefreshRequestUser {
  sub: string;
  tokenId: string;
  rawRefreshToken: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) =>
          (req?.cookies?.[REFRESH_TOKEN_COOKIE] as string) ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.refreshSecret'),
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtRefreshPayload): RefreshRequestUser {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string;
    return {
      sub: payload.sub,
      tokenId: payload.tokenId,
      rawRefreshToken,
    };
  }
}
