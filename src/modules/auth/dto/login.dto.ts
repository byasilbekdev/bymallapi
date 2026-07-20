import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: "To'g'ri email kiriting" })
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Parol kiritilishi shart' })
  password!: string;
}
