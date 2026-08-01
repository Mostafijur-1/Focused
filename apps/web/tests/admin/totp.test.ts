import { describe, expect, it } from "vitest";

import {
  generateRecoveryCodes,
  generateTotpSecret,
  verifyTotp,
} from "@/features/admin/infrastructure/security/totp";

describe("operational TOTP", () => {
  it("accepts an RFC 6238 vector and rejects replay", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    const now = new Date(59_000);

    expect(verifyTotp(secret, "287082", now, -1n)).toBe(1n);
    expect(verifyTotp(secret, "287082", now, 1n)).toBeNull();
  });

  it("creates authenticator-compatible secrets and unique recovery codes", () => {
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]{32}$/u);
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    expect(codes[0]).toMatch(/^[A-F0-9]{4}(?:-[A-F0-9]{4}){3}$/u);
  });
});
