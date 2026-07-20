import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { User } from '@prisma/client';
import { UsersService } from '../../users/users.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID') ?? '',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') ?? '',
      callbackURL: config.get<string>('GOOGLE_CALLBACK_URL') ?? '',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) {
        return done(new Error('Google profilida email topilmadi'), false);
      }

      let user: User | null = await this.usersService.findByGoogleId(
        profile.id,
      );

      if (!user) {
        // If an email/password account already exists with this email,
        // link the Google id instead of creating a duplicate account.
        const existingByEmail = await this.usersService.findByEmail(email);

        if (existingByEmail) {
          user = existingByEmail;
        } else {
          user = await this.usersService.createGoogleUser({
            email,
            googleId: profile.id,
            firstName: profile.name?.givenName,
            lastName: profile.name?.familyName,
            avatarUrl: profile.photos?.[0]?.value,
          });
        }
      }

      done(null, user);
    } catch (error) {
      done(error as Error, false);
    }
  }
}
