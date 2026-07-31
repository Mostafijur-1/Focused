import { hash, verify } from "@node-rs/argon2";

import type { PasswordHasher } from "@/features/auth/application/ports";

const options = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export class ArgonPasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password, options);
  }

  async verify(
    passwordHash: string | null,
    password: string,
  ): Promise<boolean> {
    if (!passwordHash) {
      await hash(password, options);
      return false;
    }

    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }
}
