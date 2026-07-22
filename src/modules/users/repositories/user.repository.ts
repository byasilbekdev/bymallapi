import { Injectable } from '@nestjs/common';
import { AuthProvider, User } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface CreateLocalUserInput {
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

export interface CreateGoogleUserInput {
  email: string;
  googleId: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { googleId } });
  }

  createLocalUser(input: CreateLocalUserInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: input.email,
        password: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phoneNumber: input.phoneNumber,
        provider: AuthProvider.LOCAL,
      },
    });
  }

  createGoogleUser(input: CreateGoogleUserInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: input.email,
        googleId: input.googleId,
        firstName: input.firstName,
        lastName: input.lastName,
        avatarUrl: input.avatarUrl,
        provider: AuthProvider.GOOGLE,
        isEmailVerified: true,
      },
    });
  }

  markEmailVerified(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true },
    });
  }

  updatePassword(userId: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { password: passwordHash },
    });
  }
}
