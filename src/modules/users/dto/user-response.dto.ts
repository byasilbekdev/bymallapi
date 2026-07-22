import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class UserResponseDto {
  @Expose()
  id!: string;

  @Expose()
  email!: string;

  @Expose()
  firstName!: string | null;

  @Expose()
  lastName!: string | null;

  @Expose()
  phoneNumber!: string | null;

  @Expose()
  avatarUrl!: string | null;

  @Expose()
  isEmailVerified!: boolean;

  @Expose()
  provider!: string;

  @Expose()
  createdAt!: Date;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}
