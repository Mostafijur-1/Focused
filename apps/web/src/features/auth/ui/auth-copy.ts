import type { Locale } from "@/i18n/config";

const copy = {
  "bn-BD": {
    signInTitle: "Focused-এ আবার স্বাগতম",
    signInDescription:
      "Google দিয়ে নিরাপদে প্রবেশ করে আপনার মনোযোগের জায়গায় ফিরে আসুন।",
    signUpTitle: "আপনার FocusOS শুরু করুন",
    signUpDescription:
      "Google দিয়ে নিরাপদে Account তৈরি করুন—আলাদা কোনো Password মনে রাখতে হবে না।",
    signIn: "প্রবেশ করুন",
    signingIn: "Google-এ নেওয়া হচ্ছে…",
    google: "Google দিয়ে চালিয়ে যান",
    securityNote:
      "Authentication Google-এর মাধ্যমে সম্পন্ন হয়। Focused আপনার Google Password দেখে না বা সংরক্ষণ করে না।",
    unexpected: "অনুরোধটি সম্পন্ন হয়নি। আবার চেষ্টা করুন।",
    offline: "আপনি offline আছেন। সংযোগ ফিরে এলে আবার চেষ্টা করুন।",
    sessionExpired: "Session শেষ হয়েছে। আবার প্রবেশ করুন।",
    securityTitle: "Security ও sessions",
    securityDescription:
      "কোন কোন device-এ Focused খোলা আছে দেখুন এবং অচেনা session বন্ধ করুন।",
    currentSession: "এই device",
    revoke: "Session বন্ধ করুন",
    revokeOthers: "অন্য সব session বন্ধ করুন",
    noSessions: "কোনো active session পাওয়া যায়নি।",
    loadingSessions: "Sessions লোড হচ্ছে…",
    authComplete: "নিরাপদ Authentication সম্পন্ন হচ্ছে…",
  },
  en: {
    signInTitle: "Welcome back to Focused",
    signInDescription:
      "Continue securely with Google and return to your attention space.",
    signUpTitle: "Start your FocusOS",
    signUpDescription:
      "Create your account securely with Google—there is no separate password to remember.",
    signIn: "Sign in",
    signingIn: "Taking you to Google…",
    google: "Continue with Google",
    securityNote:
      "Authentication is handled by Google. Focused never sees or stores your Google password.",
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
    authComplete: "Completing secure Authentication…",
  },
} as const;

export type AuthCopy = (typeof copy)["bn-BD"] | (typeof copy)["en"];

export function getAuthCopy(locale: Locale): AuthCopy {
  return copy[locale];
}
