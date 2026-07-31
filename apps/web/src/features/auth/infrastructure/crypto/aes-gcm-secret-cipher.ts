import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import type { SecretCipher } from "@/features/auth/application/oauth-ports";

export class AesGcmSecretCipher implements SecretCipher {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, "base64");
    if (this.key.length !== 32) {
      throw new Error(
        "AUTH_DATA_ENCRYPTION_KEY_BASE64 must contain exactly 32 bytes.",
      );
    }
  }

  encrypt(plaintext: string): Uint8Array<ArrayBuffer> {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    return Uint8Array.from(
      Buffer.concat([iv, cipher.getAuthTag(), ciphertext]),
    );
  }

  decrypt(payload: Uint8Array<ArrayBufferLike>): string {
    const value = Buffer.from(payload);
    if (value.length < 29)
      throw new Error("Encrypted OAuth secret is invalid.");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      value.subarray(0, 12),
    );
    decipher.setAuthTag(value.subarray(12, 28));
    return Buffer.concat([
      decipher.update(value.subarray(28)),
      decipher.final(),
    ]).toString("utf8");
  }
}
