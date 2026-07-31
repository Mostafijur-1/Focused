import {
  canAuthenticate,
  isPlausibleEmail,
  normalizeEmail,
  validatePassword,
} from "@/features/auth/domain/auth-policy";

describe("authentication policy", () => {
  it("normalizes email without altering password entropy", () => {
    expect(normalizeEmail("  Person@Example.COM ")).toBe("person@example.com");
    expect(isPlausibleEmail("person@example.com")).toBe(true);
    expect(isPlausibleEmail("not-an-email")).toBe(false);
  });

  it("enforces length, whitespace, and email-local-part safeguards", () => {
    expect(validatePassword("short", "person@example.com")).toContain(
      "too_short",
    );
    expect(
      validatePassword(" person-secure-passphrase ", "person@example.com"),
    ).toEqual(expect.arrayContaining(["outer_whitespace", "contains_email"]));
    expect(
      validatePassword("একটি-দীর্ঘ-নিরাপদ-password", "person@example.com"),
    ).toEqual([]);
  });

  it("permits authentication only for active verified users", () => {
    expect(canAuthenticate("ACTIVE", new Date())).toBe(true);
    expect(canAuthenticate("ACTIVE", null)).toBe(false);
    expect(canAuthenticate("SUSPENDED", new Date())).toBe(false);
  });
});
