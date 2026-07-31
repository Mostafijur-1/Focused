import {
  loginRequestSchema,
  oauthCallbackQuerySchema,
  oauthStartRequestSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
} from "@/features/auth/transport/auth-schemas";

describe("authentication transport schemas", () => {
  it("accepts valid native-Bangla registration input", () => {
    expect(
      registerRequestSchema.safeParse({
        email: "person@example.com",
        password: "একটি-দীর্ঘ-নিরাপদ-password",
        displayName: "মোস্তাফিজুর",
        locale: "bn-BD",
        timeZone: "Asia/Dhaka",
      }).success,
    ).toBe(true);
  });

  it("rejects over-posting, weak credentials, and malformed OAuth callbacks", () => {
    expect(
      loginRequestSchema.safeParse({ email: "bad", password: "x" }).success,
    ).toBe(false);
    expect(
      registerRequestSchema.safeParse({
        email: "person@example.com",
        password: "weak",
        displayName: "Person",
        locale: "en",
        timeZone: "UTC",
        role: "admin",
      }).success,
    ).toBe(false);
    expect(
      oauthCallbackQuerySchema.safeParse({ code: "x", state: "short" }).success,
    ).toBe(false);
    expect(
      resetPasswordRequestSchema.safeParse({ token: "x", password: "weak" })
        .success,
    ).toBe(false);
  });

  it("accepts only locale-scoped OAuth start data", () => {
    expect(
      oauthStartRequestSchema.safeParse({
        locale: "bn-BD",
        timeZone: "Asia/Dhaka",
        returnTo: "/bn-BD/auth-complete",
      }).success,
    ).toBe(true);
  });
});
