import type { Locale } from "@/i18n/config";

const copy = {
  "bn-BD": {
    title: "নিরাপদ Platform পরিচালনা",
    subtitle:
      "ন্যূনতম তথ্য, স্পষ্ট কারণ এবং যাচাইযোগ্য audit evidence দিয়ে Focused পরিচালনা করুন।",
    forbiddenTitle: "Admin access নেই",
    forbiddenBody: "এই workspace শুধু অনুমোদিত operational role-এর জন্য।",
    mfaTitle: "Operational MFA",
    mfaSetup:
      "Authenticator app-এ key যোগ করে recovery code নিরাপদ স্থানে রাখুন। এগুলো আর দেখানো হবে না।",
    startMfa: "MFA setup শুরু করুন",
    verifyMfa: "MFA যাচাই করুন",
    verifySession: "এই session যাচাই করুন",
    code: "৬ সংখ্যার code",
    recovery: "Recovery code",
    caseTitle: "Operational case",
    caseBody:
      "কোনো member বা system তথ্য দেখার আগে কাজের কারণ ও সীমিত সময় নির্ধারণ করুন।",
    reason: "কারণ",
    summary: "কাজের সংক্ষিপ্ত বিবরণ",
    reference: "Ticket/incident reference (ঐচ্ছিক)",
    duration: "সময় (মিনিট)",
    openCase: "Case খুলুন",
    activeCase: "সক্রিয় case",
    overview: "Platform overview",
    accounts: "Account",
    activeSessions: "সক্রিয় session",
    queuedJobs: "Queue-তে job",
    failedOperations: "ব্যর্থ operation",
    health: "System health",
    members: "Account support",
    memberHint:
      "শুধু exact email বা user ID দিয়ে খুঁজুন। ব্যক্তিগত content search করা যায় না।",
    identifier: "Exact email বা user ID",
    search: "খুঁজুন",
    noMember: "কোনো account পাওয়া যায়নি।",
    suspend: "Account suspend করুন",
    restore: "Account restore করুন",
    revokeSessions: "সব session revoke করুন",
    flags: "Feature Flags",
    audit: "Audit evidence",
    noData: "এখনো কোনো তথ্য নেই।",
    stepUpTitle: "Sensitive action যাচাই",
    password: "বর্তমান password (Google-only account হলে খালি রাখুন)",
    confirm: "যাচাই করে চালান",
    cancel: "বাতিল",
    loading: "তথ্য আনা হচ্ছে…",
    retry: "আবার চেষ্টা করুন",
    privacy:
      "Routine Admin view-এ Journal, note, mood, faith, health, Life Vision বা AI conversation থাকে না। Impersonation এবং break-glass access এই release-এ নেই।",
    error: "অনুরোধটি সম্পন্ন করা যায়নি।",
    saved: "পরিবর্তনটি সম্পন্ন এবং audit করা হয়েছে।",
  },
  en: {
    title: "Safe platform operations",
    subtitle:
      "Operate Focused with minimized data, explicit reasons, and verifiable audit evidence.",
    forbiddenTitle: "No Admin access",
    forbiddenBody: "This workspace is limited to authorized operational roles.",
    mfaTitle: "Operational MFA",
    mfaSetup:
      "Add the key to an authenticator app and store the recovery codes safely. They will not be shown again.",
    startMfa: "Start MFA setup",
    verifyMfa: "Verify MFA",
    verifySession: "Verify this session",
    code: "6-digit code",
    recovery: "Recovery codes",
    caseTitle: "Operational case",
    caseBody:
      "Declare a reason and bounded window before viewing member or system metadata.",
    reason: "Reason",
    summary: "Short operational summary",
    reference: "Ticket/incident reference (optional)",
    duration: "Duration (minutes)",
    openCase: "Open case",
    activeCase: "Active case",
    overview: "Platform overview",
    accounts: "Accounts",
    activeSessions: "Active sessions",
    queuedJobs: "Queued jobs",
    failedOperations: "Failed operations",
    health: "System health",
    members: "Account support",
    memberHint:
      "Search only by exact email or user ID. Private content is not searchable.",
    identifier: "Exact email or user ID",
    search: "Search",
    noMember: "No account was found.",
    suspend: "Suspend account",
    restore: "Restore account",
    revokeSessions: "Revoke all sessions",
    flags: "Feature Flags",
    audit: "Audit evidence",
    noData: "No data yet.",
    stepUpTitle: "Verify sensitive action",
    password: "Current password (leave blank for Google-only accounts)",
    confirm: "Verify and run",
    cancel: "Cancel",
    loading: "Loading…",
    retry: "Try again",
    privacy:
      "Routine Admin views never include journals, notes, mood, faith, health, Life Vision, or AI conversations. Impersonation and break-glass access are absent from this release.",
    error: "The request could not be completed.",
    saved: "The change completed and was audited.",
  },
} as const;

export type AdminCopy = (typeof copy)[Locale];

export function getAdminCopy(locale: Locale): AdminCopy {
  return copy[locale];
}
