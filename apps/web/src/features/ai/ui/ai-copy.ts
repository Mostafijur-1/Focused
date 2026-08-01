import type { AIContextScope } from "@/features/ai/domain/ai-types";
import type { Locale } from "@/i18n/config";

const bn = {
  pageTitle: "আপনার AI Coach",
  pageDescription:
    "দিনের তথ্য বুঝে ছোট, বাস্তবসম্মত পরবর্তী পদক্ষেপ নিন—নিয়ন্ত্রণ সব সময় আপনার হাতে।",
  privacyTitle: "আপনার তথ্য, আপনার অনুমতি",
  privacyDescription:
    "প্রতিটি request-এ কোন summary AI ব্যবহার করবে, তা আপনি ঠিক করবেন। Journal, mood, sleep, health, faith, notes ও Life Vision পাঠানো হয় না।",
  configured: "AI সংযোগ প্রস্তুত",
  notConfigured:
    "AI key এখনো configure করা হয়নি। নিরাপদ non-AI fallback ব্যবহার করা হবে।",
  privacyBlocked:
    "Provider configure করা আছে, কিন্তু ব্যক্তিগত তথ্য পাঠানোর privacy control অনুমোদিত নয়। non-AI fallback ব্যবহার করা হবে।",
  sources: "ব্যবহৃত source",
  sourceEmpty: "কোনো source নির্বাচন করা হয়নি",
  scopes: {
    daily_plan: "আজকের পরিকল্পনার summary",
    focus_summary: "Focus Session-এর summary",
    habit_summary: "অভ্যাসের summary",
    goal_summary: "লক্ষ্যের summary",
  } satisfies Record<AIContextScope, string>,
  coachTitle: "Coach-এর সঙ্গে কথা বলুন",
  coachHint:
    "আপনার বর্তমান বাধা বা পরবর্তী সিদ্ধান্তটি লিখুন। ব্যক্তিগত বা সংবেদনশীল তথ্য না দেওয়াই ভালো।",
  messageLabel: "আপনার কথা",
  messagePlaceholder: "যেমন: আজ কোন কাজটি আগে করলে সবচেয়ে বেশি অগ্রগতি হবে?",
  send: "পাঠান",
  sending: "Coach ভাবছে…",
  newConversation: "নতুন আলোচনা",
  emptyConversation:
    "একটি প্রশ্ন দিয়ে আলোচনা শুরু করুন। AI অনুমান না করে নির্বাচিত তথ্যের ভিত্তিতে উত্তর দেবে।",
  userLabel: "আপনি",
  assistantLabel: "AI Coach",
  dailyTitle: "AI Daily Review",
  dailyDescription:
    "আজকের নির্বাচিত তথ্য থেকে অর্জন, বাধা ও সর্বোচ্চ তিনটি পরবর্তী কাজ দেখুন।",
  generateReview: "আজকের Review তৈরি করুন",
  generatingReview: "Review তৈরি হচ্ছে…",
  goalProposal: "প্রয়োজনে Goal proposal দিন",
  deterministic: "non-AI fallback",
  reviewWins: "যা ভালো হয়েছে",
  reviewFriction: "যেখানে বাধা ছিল",
  reviewNext: "পরবর্তী ছোট পদক্ষেপ",
  missingData: "যে তথ্য পাওয়া যায়নি",
  proposalsTitle: "আপনার অনুমোদনের অপেক্ষায়",
  proposalDescription:
    "Apply করলে তবেই Goal তৈরি হবে। আগে title সম্পাদনা করতে পারেন।",
  proposalTitleLabel: "Goal title",
  apply: "Goal হিসেবে Apply করুন",
  applying: "Apply হচ্ছে…",
  reject: "বাদ দিন",
  applied: "Goal তৈরি হয়েছে",
  retry: "আবার চেষ্টা করুন",
  offline:
    "AI feature offline অবস্থায় চালানো যায় না। Internet ফিরে এলে চেষ্টা করুন।",
  signedOut: "AI Coach ব্যবহার করতে Sign in করুন।",
  signIn: "Sign in",
  loadError: "AI Coach-এর তথ্য লোড করা যায়নি।",
  requestError: "Request সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।",
  streamWarning: "AI সেবা না পাওয়ায় fallback দেখানো হয়েছে।",
  noReview: "আজকের Review এখনো তৈরি হয়নি।",
} as const;

export type AICopy = {
  readonly [K in Exclude<keyof typeof bn, "scopes">]: string;
} & { readonly scopes: Readonly<Record<AIContextScope, string>> };

const en: AICopy = {
  pageTitle: "Your AI Coach",
  pageDescription:
    "Turn today's evidence into a small, practical next step—while staying fully in control.",
  privacyTitle: "Your data, your permission",
  privacyDescription:
    "You choose which summaries AI may use for every request. Journal, mood, sleep, health, faith, notes, and Life Vision are excluded.",
  configured: "AI connection is ready",
  notConfigured:
    "AI keys are not configured. A safe non-AI fallback will be used.",
  privacyBlocked:
    "A provider is configured, but its privacy controls are not approved for personal data. A non-AI fallback will be used.",
  sources: "Sources used",
  sourceEmpty: "No sources selected",
  scopes: {
    daily_plan: "Daily plan summary",
    focus_summary: "Focus Session summary",
    habit_summary: "Habit summary",
    goal_summary: "Goal summary",
  },
  coachTitle: "Talk with your coach",
  coachHint:
    "Describe your current blocker or next decision. Avoid adding sensitive personal information.",
  messageLabel: "Your message",
  messagePlaceholder:
    "For example: Which task would create the most progress today?",
  send: "Send",
  sending: "Coach is thinking…",
  newConversation: "New conversation",
  emptyConversation:
    "Start with a question. AI will use only the sources you select instead of guessing.",
  userLabel: "You",
  assistantLabel: "AI Coach",
  dailyTitle: "AI Daily Review",
  dailyDescription:
    "Use today's selected evidence to see wins, friction, and up to three next actions.",
  generateReview: "Create today's review",
  generatingReview: "Creating review…",
  goalProposal: "Include a Goal proposal when useful",
  deterministic: "non-AI fallback",
  reviewWins: "Wins",
  reviewFriction: "Friction",
  reviewNext: "Small next steps",
  missingData: "Missing data",
  proposalsTitle: "Waiting for your approval",
  proposalDescription:
    "A Goal is created only after Apply. You can edit the title first.",
  proposalTitleLabel: "Goal title",
  apply: "Apply as Goal",
  applying: "Applying…",
  reject: "Dismiss",
  applied: "Goal created",
  retry: "Try again",
  offline:
    "AI features do not run offline. Try again when your connection returns.",
  signedOut: "Sign in to use AI Coach.",
  signIn: "Sign in",
  loadError: "AI Coach data could not be loaded.",
  requestError: "The request could not be completed. Try again.",
  streamWarning: "A fallback was shown because the AI service was unavailable.",
  noReview: "Today's review has not been created yet.",
};

export function getAICopy(locale: Locale): AICopy {
  return locale === "bn-BD" ? bn : en;
}
