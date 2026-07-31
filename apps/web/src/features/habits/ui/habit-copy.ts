import type { Locale } from "@/i18n/config";

export interface HabitCopy {
  readonly pageTitle: string;
  readonly pageDescription: string;
  readonly eyebrow: string;
  readonly heading: string;
  readonly subtitle: string;
  readonly newHabit: string;
  readonly refresh: string;
  readonly loading: string;
  readonly signInTitle: string;
  readonly signInBody: string;
  readonly signIn: string;
  readonly emptyTitle: string;
  readonly emptyBody: string;
  readonly title: string;
  readonly titlePlaceholder: string;
  readonly kind: string;
  readonly schedule: string;
  readonly startsOn: string;
  readonly target: string;
  readonly unit: string;
  readonly save: string;
  readonly cancel: string;
  readonly edit: string;
  readonly archive: string;
  readonly restore: string;
  readonly pause: string;
  readonly resume: string;
  readonly complete: string;
  readonly undo: string;
  readonly skip: string;
  readonly history: string;
  readonly noHistory: string;
  readonly consistency: string;
  readonly streak: string;
  readonly dueToday: string;
  readonly notDue: string;
  readonly excused: string;
  readonly completed: string;
  readonly skipped: string;
  readonly archived: string;
  readonly archivedSection: string;
  readonly offline: string;
  readonly queued: string;
  readonly syncConflict: string;
  readonly genericError: string;
  readonly changedElsewhere: string;
  readonly weekdays: string;
  readonly intervalDays: string;
  readonly anchorDate: string;
  readonly customDates: string;
  readonly customDatesHint: string;
  readonly value: string;
  readonly reducedPressure: string;
  readonly kinds: Readonly<
    Record<"boolean" | "count" | "duration" | "avoidance", string>
  >;
  readonly schedules: Readonly<
    Record<"daily" | "weekdays" | "interval" | "custom_dates", string>
  >;
  readonly dayNames: readonly string[];
}

const bangla: HabitCopy = {
  pageTitle: "অভ্যাস | Focused",
  pageDescription: "চাপ নয়—সচেতনভাবে অভ্যাস গড়ে তুলুন এবং ধারাবাহিকতা বুঝুন।",
  eyebrow: "Habit System",
  heading: "ছোট পদক্ষেপ, টেকসই পরিবর্তন",
  subtitle: "আজ যা সম্ভব, সেটুকুই করুন। বিরতি বা বাদ যাওয়া ব্যর্থতা নয়।",
  newHabit: "নতুন অভ্যাস",
  refresh: "হালনাগাদ করুন",
  loading: "অভ্যাসগুলো প্রস্তুত হচ্ছে",
  signInTitle: "আপনার অভ্যাস দেখতে Sign in করুন",
  signInBody: "আপনার অগ্রগতি শুধু আপনার account-এই সুরক্ষিত থাকবে।",
  signIn: "Sign in",
  emptyTitle: "প্রথম ছোট পদক্ষেপটি ঠিক করুন",
  emptyBody:
    "সহজে করা যায় এমন একটি অভ্যাস দিয়ে শুরু করুন। পরে সময়সূচি বদলানো যাবে।",
  title: "অভ্যাসের নাম",
  titlePlaceholder: "যেমন: ২০ মিনিট পড়া",
  kind: "ধরন",
  schedule: "সময়সূচি",
  startsOn: "শুরুর দিন",
  target: "লক্ষ্যমাত্রা",
  unit: "একক",
  save: "সংরক্ষণ করুন",
  cancel: "বাতিল",
  edit: "সম্পাদনা",
  archive: "Archive করুন",
  restore: "ফিরিয়ে আনুন",
  pause: "বিরতি নিন",
  resume: "আবার শুরু করুন",
  complete: "আজ সম্পন্ন",
  undo: "Undo",
  skip: "আজ বাদ দিন",
  history: "ইতিহাস",
  noHistory: "এখনও কোনো ইতিহাস নেই।",
  consistency: "ধারাবাহিকতা",
  streak: "চলমান ধারা",
  dueToday: "আজ করার দিন",
  notDue: "আজ নির্ধারিত নয়",
  excused: "বিরতির দিন",
  completed: "সম্পন্ন",
  skipped: "বাদ দেওয়া হয়েছে",
  archived: "Archived",
  archivedSection: "Archived অভ্যাস",
  offline: "আপনি Offline আছেন। আগে দেখা তথ্য দেখানো হচ্ছে।",
  queued: "Check-in নিরাপদে রাখা হয়েছে; Online হলে Sync হবে।",
  syncConflict: "অন্য device-এ তথ্য বদলেছে। হালনাগাদ করে আবার চেষ্টা করুন।",
  genericError: "এই কাজটি এখন সম্পন্ন করা গেল না। আবার চেষ্টা করুন।",
  changedElsewhere: "তথ্য অন্য কোথাও বদলেছে। সর্বশেষ অবস্থা আনা হয়েছে।",
  weekdays: "সপ্তাহের দিন",
  intervalDays: "কত দিন পরপর",
  anchorDate: "প্রথম নির্ধারিত দিন",
  customDates: "নির্দিষ্ট তারিখ",
  customDatesHint: "কমা দিয়ে YYYY-MM-DD format-এ তারিখ লিখুন।",
  value: "আজকের পরিমাণ",
  reducedPressure: "Streak-এর চেয়ে ফিরে আসাটাই গুরুত্বপূর্ণ।",
  kinds: {
    boolean: "হ্যাঁ / না",
    count: "সংখ্যা",
    duration: "সময়",
    avoidance: "এড়িয়ে চলা",
  },
  schedules: {
    daily: "প্রতিদিন",
    weekdays: "নির্বাচিত দিন",
    interval: "বিরতি দিয়ে",
    custom_dates: "নির্দিষ্ট তারিখ",
  },
  dayNames: ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহস্পতি", "শুক্র", "শনি"],
};

const english: HabitCopy = {
  pageTitle: "Habits | Focused",
  pageDescription:
    "Build habits without shame and understand your consistency.",
  eyebrow: "Habit System",
  heading: "Small steps, durable change",
  subtitle: "Do what is possible today. A pause or missed day is not failure.",
  newHabit: "New habit",
  refresh: "Refresh",
  loading: "Preparing your habits",
  signInTitle: "Sign in to see your habits",
  signInBody: "Your progress stays protected in your account.",
  signIn: "Sign in",
  emptyTitle: "Choose your first small step",
  emptyBody:
    "Start with something easy enough to repeat. You can change its schedule later.",
  title: "Habit name",
  titlePlaceholder: "For example: Read for 20 minutes",
  kind: "Type",
  schedule: "Schedule",
  startsOn: "Start date",
  target: "Target",
  unit: "Unit",
  save: "Save",
  cancel: "Cancel",
  edit: "Edit",
  archive: "Archive",
  restore: "Restore",
  pause: "Pause",
  resume: "Resume",
  complete: "Complete today",
  undo: "Undo",
  skip: "Skip today",
  history: "History",
  noHistory: "No history yet.",
  consistency: "Consistency",
  streak: "Current rhythm",
  dueToday: "Due today",
  notDue: "Not scheduled today",
  excused: "Pause day",
  completed: "Completed",
  skipped: "Skipped",
  archived: "Archived",
  archivedSection: "Archived habits",
  offline: "You are offline. Previously loaded information is shown.",
  queued: "Check-in saved safely and will sync when you are online.",
  syncConflict: "This changed on another device. Refresh and try again.",
  genericError: "This action could not be completed. Please try again.",
  changedElsewhere: "This changed elsewhere. The latest state has been loaded.",
  weekdays: "Days of week",
  intervalDays: "Repeat every",
  anchorDate: "First due date",
  customDates: "Specific dates",
  customDatesHint: "Enter comma-separated dates in YYYY-MM-DD format.",
  value: "Today's amount",
  reducedPressure: "Returning matters more than protecting a streak.",
  kinds: {
    boolean: "Yes / no",
    count: "Count",
    duration: "Duration",
    avoidance: "Avoidance",
  },
  schedules: {
    daily: "Daily",
    weekdays: "Selected days",
    interval: "Interval",
    custom_dates: "Specific dates",
  },
  dayNames: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

export function getHabitCopy(locale: Locale): HabitCopy {
  return locale === "bn-BD" ? bangla : english;
}
