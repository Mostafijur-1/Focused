import type { Locale } from "@/i18n/config";

const copy = {
  "bn-BD": {
    signInTitle: "আবার স্বাগতম",
    signInDescription: "মনোযোগের জায়গায় ফিরে আসুন—শান্তভাবে, নিরাপদে।",
    signUpTitle: "আপনার FocusOS তৈরি করুন",
    signUpDescription:
      "একটি account, একটি পরিষ্কার দিকনির্দেশনা, প্রতিদিন একটু উন্নতি।",
    email: "Email",
    password: "Password",
    newPassword: "নতুন Password",
    displayName: "আপনার নাম",
    signIn: "Sign in",
    signUp: "Account তৈরি করুন",
    signingIn: "Sign in হচ্ছে…",
    creating: "Account তৈরি হচ্ছে…",
    forgotPassword: "Password মনে নেই?",
    noAccount: "এখনও account নেই?",
    haveAccount: "আগেই account আছে?",
    recoveryTitle: "Account ফিরে পান",
    recoveryDescription:
      "Email দিন। Accountটি উপযুক্ত হলে আমরা নিরাপদ নির্দেশনা পাঠাব।",
    sendRecovery: "নির্দেশনা পাঠান",
    sending: "পাঠানো হচ্ছে…",
    resetTitle: "নতুন Password তৈরি করুন",
    resetDescription:
      "কমপক্ষে ১২ অক্ষরের আলাদা ও মনে রাখার মতো Password ব্যবহার করুন।",
    resetPassword: "Password পরিবর্তন করুন",
    resetting: "পরিবর্তন হচ্ছে…",
    verifyTitle: "Email যাচাই করুন",
    verifyDescription: "নিরাপদ link যাচাই করে account চালু করা হচ্ছে।",
    verifying: "যাচাই হচ্ছে…",
    verified: "Email যাচাই হয়েছে। এখন Sign in করতে পারেন।",
    genericRegistration:
      "অনুরোধ গ্রহণ করা হয়েছে। Emailটি ব্যবহারযোগ্য হলে যাচাইয়ের নির্দেশনা পৌঁছে যাবে।",
    genericRecovery:
      "অনুরোধ গ্রহণ করা হয়েছে। Accountটি উপযুক্ত হলে নিরাপদ নির্দেশনা পৌঁছে যাবে।",
    google: "Google দিয়ে চালিয়ে যান",
    github: "GitHub দিয়ে চালিয়ে যান",
    microsoft: "Microsoft দিয়ে চালিয়ে যান",
    or: "অথবা",
    securityNote:
      "আপনার refresh token browser-এর নিরাপদ HttpOnly cookie-তে থাকে; Password বা token কখনও log করা হয় না।",
    unexpected: "অনুরোধটি সম্পন্ন হয়নি। আবার চেষ্টা করুন।",
    offline: "আপনি offline আছেন। সংযোগ ফিরে এলে আবার চেষ্টা করুন।",
    sessionExpired: "Session শেষ হয়েছে। আবার Sign in করুন।",
    securityTitle: "Security ও sessions",
    securityDescription:
      "কোন কোন device-এ Focused খোলা আছে দেখুন এবং অচেনা session বন্ধ করুন।",
    currentSession: "এই device",
    revoke: "Session বন্ধ করুন",
    revokeOthers: "অন্য সব session বন্ধ করুন",
    noSessions: "কোনো active session পাওয়া যায়নি।",
    loadingSessions: "Sessions লোড হচ্ছে…",
    authComplete: "নিরাপদ Sign in সম্পন্ন হচ্ছে…",
  },
  en: {
    signInTitle: "Welcome back",
    signInDescription: "Return to your attention space—calmly and securely.",
    signUpTitle: "Create your FocusOS",
    signUpDescription:
      "One account, a clear direction, and steady daily progress.",
    email: "Email",
    password: "Password",
    newPassword: "New password",
    displayName: "Your name",
    signIn: "Sign in",
    signUp: "Create account",
    signingIn: "Signing in…",
    creating: "Creating account…",
    forgotPassword: "Forgot password?",
    noAccount: "No account yet?",
    haveAccount: "Already have an account?",
    recoveryTitle: "Recover your account",
    recoveryDescription:
      "Enter your email. If eligible, we will send secure instructions.",
    sendRecovery: "Send instructions",
    sending: "Sending…",
    resetTitle: "Create a new password",
    resetDescription:
      "Use a unique, memorable password with at least 12 characters.",
    resetPassword: "Change password",
    resetting: "Changing…",
    verifyTitle: "Verify your email",
    verifyDescription:
      "We are validating the secure link and activating your account.",
    verifying: "Verifying…",
    verified: "Email verified. You can now sign in.",
    genericRegistration:
      "Request accepted. Verification instructions will arrive if the email is eligible.",
    genericRecovery:
      "Request accepted. Secure instructions will arrive if the account is eligible.",
    google: "Continue with Google",
    github: "Continue with GitHub",
    microsoft: "Continue with Microsoft",
    or: "or",
    securityNote:
      "Your refresh token stays in a secure HttpOnly cookie; passwords and tokens are never logged.",
    unexpected: "The request could not be completed. Try again.",
    offline: "You are offline. Try again when your connection returns.",
    sessionExpired: "Your session ended. Sign in again.",
    securityTitle: "Security and sessions",
    securityDescription:
      "Review devices where Focused is open and close sessions you do not recognize.",
    currentSession: "This device",
    revoke: "Close session",
    revokeOthers: "Close all other sessions",
    noSessions: "No active sessions were found.",
    loadingSessions: "Loading sessions…",
    authComplete: "Completing secure sign-in…",
  },
} as const;

export type AuthCopy = (typeof copy)["bn-BD"] | (typeof copy)["en"];

export function getAuthCopy(locale: Locale): AuthCopy {
  return copy[locale];
}
