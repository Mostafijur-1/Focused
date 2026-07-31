const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export const authPolicy = {
  accessTokenSeconds: 10 * 60,
  refreshTokenSeconds: 30 * 24 * 60 * 60,
  sessionSeconds: 90 * 24 * 60 * 60,
  verificationTokenSeconds: 30 * 60,
  passwordResetTokenSeconds: 15 * 60,
  oauthTransactionSeconds: 10 * 60,
  clockToleranceSeconds: 30,
  passwordMinLength: 12,
  passwordMaxLength: 128,
} as const;

export function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase("en-US");
}

export function isPlausibleEmail(email: string): boolean {
  return email.length <= 320 && emailPattern.test(email);
}

export function validatePassword(
  password: string,
  email?: string,
): readonly string[] {
  const issues: string[] = [];

  if (password.length < authPolicy.passwordMinLength) issues.push("too_short");
  if (password.length > authPolicy.passwordMaxLength) issues.push("too_long");
  if (/^\s|\s$/u.test(password)) issues.push("outer_whitespace");

  const normalizedPassword = password.toLocaleLowerCase("en-US");
  if (email) {
    const localPart = normalizeEmail(email).split("@")[0];
    if (
      localPart &&
      localPart.length >= 4 &&
      normalizedPassword.includes(localPart)
    ) {
      issues.push("contains_email");
    }
  }

  return issues;
}

export function canAuthenticate(
  status: string,
  emailVerifiedAt: Date | null,
): boolean {
  return status === "ACTIVE" && emailVerifiedAt !== null;
}
