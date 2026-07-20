import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: "To'g'ri email kiriting" })
  email!: string;

  @IsString()
  @MinLength(8, { message: "Parol kamida 8 belgidan iborat bo'lishi kerak" })
  @MaxLength(72, { message: 'Parol 72 belgidan oshmasligi kerak' })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      "Parolda kamida 1 ta katta harf, 1 ta kichik harf va 1 ta raqam bo'lishi kerak",
  })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @IsOptional()
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message:
      "To'g'ri telefon raqam kiriting (E.164 format, masalan +998901234567)",
  })
  phoneNumber?: string;
}
