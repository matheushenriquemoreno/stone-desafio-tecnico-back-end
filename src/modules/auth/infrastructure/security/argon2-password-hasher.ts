import argon2 from 'argon2';
import { Injectable } from '@nestjs/common';

import type { PasswordHasher } from '../../application/ports/password-hasher';

const ARGON2ID_OPTIONS = {
  memoryCost: 19_456,
  parallelism: 1,
  timeCost: 2,
  type: argon2.argon2id,
} as const;

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  hash(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword, ARGON2ID_OPTIONS);
  }

  async verify(passwordHash: string, plainPassword: string): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, plainPassword);
    } catch {
      return false;
    }
  }
}
