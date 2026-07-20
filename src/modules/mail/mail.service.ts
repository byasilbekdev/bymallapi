import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly fromAddress: string;
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('MAIL_HOST'),
      port: this.config.get<number>('MAIL_PORT'),
      secure: false,
      auth: {
        user: this.config.get<string>('MAIL_USER'),
        pass: this.config.get<string>('MAIL_PASSWORD'),
      },
    });
    this.fromAddress = this.config.get<string>('MAIL_FROM') ?? '';
    this.frontendUrl = this.config.get<string>('FRONTEND_URL') ?? '';
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verifyUrl = `${this.frontendUrl}/verify-email?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: email,
        subject: 'Emailingizni tasdiqlang',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Emailingizni tasdiqlang</h2>
            <p>Ro'yxatdan o'tishni yakunlash uchun quyidagi tugmani bosing:</p>
            <a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">
              Emailni tasdiqlash
            </a>
            <p style="color:#666;font-size:12px;margin-top:16px;">
              Havola 24 soat davomida amal qiladi. Agar bu siz bo'lmasangiz, xabarnomani e'tiborsiz qoldiring.
            </p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${email}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: email,
        subject: 'Parolni tiklash',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Parolni tiklash so'rovi</h2>
            <p>Parolingizni tiklash uchun quyidagi tugmani bosing:</p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">
              Parolni tiklash
            </a>
            <p style="color:#666;font-size:12px;margin-top:16px;">
              Havola 1 soat davomida amal qiladi. Agar bu siz bo'lmasangiz, xabarnomani e'tiborsiz qoldiring.
            </p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
