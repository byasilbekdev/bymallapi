import { Injectable } from '@nestjs/common';
import { EmailVerificationToken } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class EmailVerificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<EmailVerificationToken> {
    return this.prisma.emailVerificationToken.create({
      data: { userId, token, expiresAt },
    });
  }

  findByToken(token: string): Promise<EmailVerificationToken | null> {
    return this.prisma.emailVerificationToken.findUnique({ where: { token } });
  }

  delete(id: string): Promise<EmailVerificationToken> {
    return this.prisma.emailVerificationToken.delete({ where: { id } });
  }
}
