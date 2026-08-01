import type { DashboardWidgetKey } from "@/features/dashboard/domain/dashboard-types";
import type { Locale } from "@/i18n/config";

export interface DashboardCopy {
  readonly pageTitle: string;
  readonly pageDescription: string;
  readonly loading: string;
  readonly loadingDescription: string;
  readonly signInTitle: string;
  readonly signInDescription: string;
  readonly signInAction: string;
  readonly greeting: (name: string) => string;
  readonly subtitle: string;
  readonly offline: string;
  readonly stale: string;
  readonly partial: string;
  readonly retry: string;
  readonly customize: string;
  readonly customizeDescription: string;
  readonly saveLayout: string;
  readonly savingLayout: string;
  readonly layoutSaved: string;
  readonly moveUp: string;
  readonly moveDown: string;
  readonly showWidget: string;
  readonly hideWidget: string;
  readonly primaryAction: string;
  readonly focusTitle: string;
  readonly focusDescription: string;
  readonly noPriorities: string;
  readonly prioritiesProgress: (complete: number, total: number) => string;
  readonly activeSessionTitle: string;
  readonly noSession: string;
  readonly activeSession: string;
  readonly pausedSession: string;
  readonly weeklyTitle: string;
  readonly weeklyEmpty: string;
  readonly focusedTime: string;
  readonly habitsTitle: string;
  readonly habitsNotConfigured: string;
  readonly habitsProgress: (complete: number, due: number) => string;
  readonly goalsTitle: string;
  readonly goalsNotConfigured: string;
  readonly goalsActive: (count: number) => string;
  readonly remindersTitle: string;
  readonly remindersNotConfigured: string;
  readonly remindersEmpty: string;
  readonly remindersDue: (count: number) => string;
  readonly aiTitle: string;
  readonly aiComingSoon: string;
  readonly unavailable: string;
  readonly guidedTitle: string;
  readonly guidedDescription: string;
  readonly guidedSteps: readonly string[];
  readonly asOf: (value: string) => string;
  readonly contextTitle: string;
  readonly contextPrivacy: string;
  readonly widgetLabels: Readonly<Record<DashboardWidgetKey, string>>;
}

const bangla: DashboardCopy = {
  pageTitle: "Dashboard",
  pageDescription:
    "আজ কী গুরুত্বপূর্ণ, এরপর কী আছে এবং কোথায় মনোযোগ দরকার—এক নজরে দেখুন।",
  loading: "Dashboard প্রস্তুত হচ্ছে",
  loadingDescription: "আজকের প্রয়োজনীয় তথ্য নিরাপদভাবে সাজানো হচ্ছে।",
  signInTitle: "আপনার Dashboard দেখতে Sign in করুন",
  signInDescription:
    "ব্যক্তিগত পরিকল্পনা ও অগ্রগতি শুধু আপনার authenticated session-এ দেখা যায়।",
  signInAction: "Sign in করুন",
  greeting: (name) => `স্বাগতম, ${name}`,
  subtitle: "আজ কী গুরুত্বপূর্ণ, সেটাই আগে ঠিক করি।",
  offline: "আপনি Offline আছেন। সর্বশেষ নিরাপদ snapshot দেখানো হচ্ছে।",
  stale: "তথ্যটি কিছুক্ষণ আগের। সংযোগ ফিরলে Refresh করুন।",
  partial: "কিছু তথ্য এখন পাওয়া যাচ্ছে না; বাকি Dashboard ব্যবহার করা যাবে।",
  retry: "আবার চেষ্টা করুন",
  customize: "Dashboard সাজান",
  customizeDescription:
    "প্রধান Focus card সব সময় প্রথমে থাকবে। অন্য card দেখানো, লুকানো বা সরানো যায়।",
  saveLayout: "বিন্যাস সংরক্ষণ করুন",
  savingLayout: "সংরক্ষণ হচ্ছে…",
  layoutSaved: "Dashboard বিন্যাস সংরক্ষিত হয়েছে।",
  moveUp: "উপরে নিন",
  moveDown: "নিচে নিন",
  showWidget: "দেখান",
  hideWidget: "লুকান",
  primaryAction: "আজকের Focus ঠিক করুন",
  focusTitle: "আজকের Focus",
  focusDescription: "একসঙ্গে সর্বোচ্চ তিনটি গুরুত্বপূর্ণ ফল সামনে রাখুন।",
  noPriorities:
    "আজকের জন্য এখনো কোনো প্রধান কাজ ঠিক করা হয়নি। ছোট করে শুরু করুন।",
  prioritiesProgress: (complete, total) =>
    `${total}টির মধ্যে ${complete}টি সম্পন্ন`,
  activeSessionTitle: "Focus Session",
  noSession:
    "এখন কোনো Focus Session চলছে না। Focus Timer থেকে একটি Session শুরু করুন।",
  activeSession: "চলছে",
  pausedSession: "বিরতিতে",
  weeklyTitle: "এই সপ্তাহ",
  weeklyEmpty: "এই সপ্তাহের অগ্রগতি তৈরি হলে এখানে সংক্ষিপ্ত চিত্র দেখা যাবে।",
  focusedTime: "Focused সময়",
  habitsTitle: "Habit",
  habitsNotConfigured: "Habit Tracker Milestone 5-এ চালু হবে।",
  habitsProgress: (complete, due) => `আজ ${due}টির মধ্যে ${complete}টি সম্পন্ন`,
  goalsTitle: "Goal",
  goalsNotConfigured: "Goal Management Milestone 6-এ চালু হবে।",
  goalsActive: (count) => `${count}টি সক্রিয় Goal`,
  remindersTitle: "Reminder",
  remindersNotConfigured: "Reminder এখনো সেট করা হয়নি।",
  remindersEmpty: "আজ আর কোনো Reminder বাকি নেই।",
  remindersDue: (count) => `আজ ${count}টি Reminder বাকি`,
  aiTitle: "AI Coach",
  aiComingSoon:
    "AI Coach Milestone 8-এ আসবে। আপনার অনুমতি ছাড়া কোনো ব্যক্তিগত তথ্য ব্যবহার করা হবে না।",
  unavailable: "এই অংশের তথ্য এখন পাওয়া যাচ্ছে না।",
  guidedTitle: "তিন ধাপে শান্তভাবে শুরু করুন",
  guidedDescription:
    "সবকিছু একদিনে সাজাতে হবে না। আজকের প্রয়োজনটুকু দিয়েই শুরু করুন।",
  guidedSteps: [
    "একটি গুরুত্বপূর্ণ ফল বেছে নিন",
    "কাজের জন্য বাস্তবসম্মত সময় রাখুন",
    "শুরু করার আগে বিভ্রান্তি সরিয়ে রাখুন",
  ],
  asOf: (value) => `সর্বশেষ হালনাগাদ ${value}`,
  contextTitle: "মনোযোগের নীতি",
  contextPrivacy:
    "Journal, mood, faith, health বা AI prompt-এর ব্যক্তিগত লেখা এই Dashboard-এ স্বয়ংক্রিয়ভাবে দেখানো হয় না।",
  widgetLabels: {
    today_focus: "আজকের Focus",
    active_session: "Focus Session",
    weekly_progress: "সাপ্তাহিক অগ্রগতি",
    habits: "Habit",
    goals: "Goal",
    reminders: "Reminder",
    ai_coach: "AI Coach",
  },
};

const english: DashboardCopy = {
  pageTitle: "Dashboard",
  pageDescription:
    "See what matters today, what comes next, and where your attention needs adjustment.",
  loading: "Preparing your Dashboard",
  loadingDescription: "Arranging today's essential information securely.",
  signInTitle: "Sign in to view your Dashboard",
  signInDescription:
    "Personal plans and progress are available only in your authenticated session.",
  signInAction: "Sign in",
  greeting: (name) => `Welcome, ${name}`,
  subtitle: "Let’s decide what matters today.",
  offline: "You are offline. Showing the latest safe snapshot from this tab.",
  stale:
    "This information may be out of date. Refresh when your connection returns.",
  partial:
    "Some information is unavailable; the rest of your Dashboard still works.",
  retry: "Try again",
  customize: "Customize Dashboard",
  customizeDescription:
    "The primary Focus card always stays first. Other cards can be shown, hidden, or moved.",
  saveLayout: "Save layout",
  savingLayout: "Saving…",
  layoutSaved: "Dashboard layout saved.",
  moveUp: "Move up",
  moveDown: "Move down",
  showWidget: "Show",
  hideWidget: "Hide",
  primaryAction: "Set today’s Focus",
  focusTitle: "Today’s Focus",
  focusDescription: "Keep no more than three important outcomes in view.",
  noPriorities: "No priority has been set for today. Start small.",
  prioritiesProgress: (complete, total) => `${complete} of ${total} complete`,
  activeSessionTitle: "Focus Session",
  noSession: "No Focus Session is active. Start one from Focus Timer.",
  activeSession: "Running",
  pausedSession: "Paused",
  weeklyTitle: "This week",
  weeklyEmpty: "A concise weekly view will appear when progress is available.",
  focusedTime: "Focused time",
  habitsTitle: "Habits",
  habitsNotConfigured: "Habit Tracker arrives in Milestone 5.",
  habitsProgress: (complete, due) => `${complete} of ${due} complete today`,
  goalsTitle: "Goals",
  goalsNotConfigured: "Goal Management arrives in Milestone 6.",
  goalsActive: (count) => `${count} active Goals`,
  remindersTitle: "Reminders",
  remindersNotConfigured: "No Reminders have been configured.",
  remindersEmpty: "No more Reminders are due today.",
  remindersDue: (count) => `${count} Reminders due today`,
  aiTitle: "AI Coach",
  aiComingSoon:
    "AI Coach arrives in Milestone 8. Personal data will never be used without your permission.",
  unavailable: "This information is temporarily unavailable.",
  guidedTitle: "Start calmly in three steps",
  guidedDescription:
    "You do not need to configure everything today. Begin with what matters now.",
  guidedSteps: [
    "Choose one important outcome",
    "Reserve a realistic amount of time",
    "Remove distractions before you begin",
  ],
  asOf: (value) => `Updated ${value}`,
  contextTitle: "Attention policy",
  contextPrivacy:
    "Private journal, mood, faith, health, and AI prompt text never appears on this Dashboard automatically.",
  widgetLabels: {
    today_focus: "Today’s Focus",
    active_session: "Focus Session",
    weekly_progress: "Weekly progress",
    habits: "Habits",
    goals: "Goals",
    reminders: "Reminders",
    ai_coach: "AI Coach",
  },
};

export function getDashboardCopy(locale: Locale): DashboardCopy {
  return locale === "bn-BD" ? bangla : english;
}
