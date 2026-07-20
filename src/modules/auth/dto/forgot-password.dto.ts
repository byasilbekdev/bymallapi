import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: "To'g'ri email kiriting" })
  email!: string;
}
