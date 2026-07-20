import { Exclude, Expose } from 'class-transformer';

/**
 * Never return the raw User entity to the client.
 * This DTO strips password and other sensitive fields.
 */
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
