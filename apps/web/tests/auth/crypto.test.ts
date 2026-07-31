// @vitest-environment node

import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";

import { AesGcmSecretCipher } from "@/features/auth/infrastructure/crypto/aes-gcm-secret-cipher";
import { ArgonPasswordHasher } from "@/features/auth/infrastructure/crypto/argon-password-hasher";
import { JoseAccessTokenIssuer } from "@/features/auth/infrastructure/crypto/jose-access-token-issuer";
import { NodeTokenGenerator } from "@/features/auth/infrastructure/crypto/node-token-generator";

describe("authentication cryptography", () => {
  it("hashes and verifies passwords with Argon2id", async () => {
    const hasher = new ArgonPasswordHasher();
    const encoded = await hasher.hash("একটি-দীর্ঘ-নিরাপদ-password");
    expect(encoded).toContain("$argon2id$");
    await expect(
      hasher.verify(encoded, "একটি-দীর্ঘ-নিরাপদ-password"),
    ).resolves.toBe(true);
    await expect(hasher.verify(encoded, "wrong-password")).resolves.toBe(false);
    await expect(hasher.verify(null, "unknown-user-password")).resolves.toBe(
      false,
    );
  });

  it("creates unpredictable opaque values and stable one-way digests", () => {
    const tokens = new NodeTokenGenerator();
    const first = tokens.opaque();
    const second = tokens.opaque();
    expect(first).not.toBe(second);
    expect(tokens.digest(first)).toHaveLength(64);
    expect(tokens.digest(first)).toBe(tokens.digest(first));
    expect(tokens.id()).toMatch(/^[0-9a-f-]{36}$/u);
  });

  it("encrypts OAuth transaction secrets with authenticated encryption", () => {
    const cipher = new AesGcmSecretCipher(
      Buffer.alloc(32, 7).toString("base64"),
    );
    const encrypted = cipher.encrypt("secret-verifier");
    expect(Buffer.from(encrypted).toString("utf8")).not.toContain(
      "secret-verifier",
    );
    expect(cipher.decrypt(encrypted)).toBe("secret-verifier");
    const tampered = Uint8Array.from(encrypted);
    tampered[tampered.length - 1]! ^= 1;
    expect(() => cipher.decrypt(tampered)).toThrow();
    expect(() => new AesGcmSecretCipher("invalid")).toThrow();
  });

  it("issues and verifies bounded EdDSA JWTs and rejects tampering", async () => {
    const { privateKey, publicKey } = await generateKeyPair("Ed25519", {
      extractable: true,
    });
    const issuer = new JoseAccessTokenIssuer({
      privateKey: await exportPKCS8(privateKey),
      publicKey: await exportSPKI(publicKey),
      keyId: "test-key",
      issuer: "https://focused.test",
      audience: "focused-api",
      lifetimeSeconds: 600,
    });
    const now = new Date("2026-07-31T12:00:00.000Z");
    const claims = {
      subject: "00000000-0000-4000-8000-000000000001",
      sessionId: "00000000-0000-4000-8000-000000000002",
      jwtId: "00000000-0000-4000-8000-000000000003",
      permissionVersion: 2,
      permissions: ["sessions:read:own"],
    };
    const token = await issuer.issue(claims, now);
    await expect(
      issuer.verify(token, new Date(now.getTime() + 60_000)),
    ).resolves.toEqual(claims);
    const [header, payload, signature] = token.split(".");
    const tamperedSignature = `${signature?.startsWith("A") ? "B" : "A"}${signature?.slice(1)}`;
    await expect(
      issuer.verify(`${header}.${payload}.${tamperedSignature}`, now),
    ).rejects.toMatchObject({
      code: "AUTH_INVALID_CREDENTIALS",
    });
    await expect(
      issuer.verify(token, new Date(now.getTime() + 700_000)),
    ).rejects.toMatchObject({
      code: "AUTH_INVALID_CREDENTIALS",
    });
  });
});
