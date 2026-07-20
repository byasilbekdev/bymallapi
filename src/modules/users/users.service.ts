import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import {
  UserRepository,
  CreateLocalUserInput,
  CreateGoogleUserInput,
} from './repositories/user.repository';

@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  findById(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.userRepository.findByGoogleId(googleId);
  }

  createLocalUser(input: CreateLocalUserInput): Promise<User> {
    return this.userRepository.createLocalUser(input);
  }

  createGoogleUser(input: CreateGoogleUserInput): Promise<User> {
    return this.userRepository.createGoogleUser(input);
  }

  markEmailVerified(userId: string): Promise<User> {
    return this.userRepository.markEmailVerified(userId);
  }

  updatePassword(userId: string, passwordHash: string): Promise<User> {
    return this.userRepository.updatePassword(userId, passwordHash);
  }
}
