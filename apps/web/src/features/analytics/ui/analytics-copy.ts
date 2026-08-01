import type { Locale } from "@/i18n/config";

export function getAnalyticsCopy(locale: Locale) {
  return locale === "bn-BD" ? bn : en;
}

const bn = {
  eyebrow: "অগ্রগতি, বিচার নয়",
  title: "Focus Analytics",
  subtitle: "আপনার কাজের ছন্দ দেখুন, তারপর ছোট একটি উন্নতি বেছে নিন।",
  start: "শুরুর তারিখ",
  end: "শেষের তারিখ",
  apply: "সময়সীমা দেখুন",
  applying: "হিসাব করা হচ্ছে…",
  refresh: "আবার হিসাব করুন",
  focusedTime: "মনোযোগের সময়",
  completedSessions: "শেষ করা Focus Session",
  planAttainment: "পরিকল্পনা পূরণ",
  habitCompletion: "অভ্যাস সম্পন্ন",
  activeDays: "সক্রিয় দিন",
  goalCheckIns: "লক্ষ্যের অগ্রগতি লেখা",
  noDenominator: "হিসাবের মতো data নেই",
  trendTitle: "প্রতিদিনের মনোযোগ",
  trendDescription: "শুধু সম্পন্ন Focus Session-এর সময়।",
  tableView: "বিস্তারিত data table",
  date: "তারিখ",
  focusMinutes: "Focus মিনিট",
  sessions: "Session",
  interruptions: "বিভ্রান্তি",
  habits: "অভ্যাস",
  distractionTitle: "Distraction Analytics",
  distractionDescription:
    "শুধু আপনি নিজে যে interruption লিখেছেন—কোনো passive tracking নয়।",
  sampleSize: (count: number) => `নমুনা: ${count}টি interruption`,
  notCausation: "এটি একটি pattern মাত্র; কারণ প্রমাণ করে না।",
  category: "ধরন",
  count: "সংখ্যা",
  noInterruptions: "এই সময়ে কোনো interruption লেখা হয়নি।",
  categoryLabels: {
    notification: "Notification",
    phone: "ফোন",
    person: "মানুষ",
    thought: "নিজের চিন্তা",
    environment: "পরিবেশ",
    other: "অন্যান্য",
  } as Record<string, string>,
  reportsTitle: "Report ও Export",
  reportsDescription:
    "এই মুহূর্তের হিসাব অপরিবর্তনীয় Report হিসেবে রাখুন, অথবা privacy-filtered file নিন।",
  saveReport: "Report সংরক্ষণ",
  savingReport: "Report তৈরি হচ্ছে…",
  exportCsv: "CSV Export",
  exportJson: "JSON Export",
  creatingExport: "Export তৈরি হচ্ছে…",
  reportSaved: "Report সংরক্ষণ করা হয়েছে।",
  exportReady: "Export প্রস্তুত।",
  download: "Download",
  expires: "মেয়াদ শেষ",
  privacyTitle: "কী রাখা হয় না",
  privacyBody:
    "Intent, outcome text, interruption note, goal বা habit note, Journal, Reflection এবং AI কথোপকথন এই Analytics-এ রাখা হয় না।",
  gamificationTitle: "ঐচ্ছিক Gamification",
  gamificationDescription:
    "XP ও Level শুধু ইতিবাচক অগ্রগতির নরম স্বীকৃতি। বিশ্রাম বা বাদ পড়া দিনের জন্য XP কমে না।",
  enabled: "XP ও Level চালু",
  level: (level: number, title: string) => `Level ${level} · ${title}`,
  xp: (value: number) => `${value} XP`,
  savePreference: "পছন্দ সংরক্ষণ",
  loading: "Analytics তৈরি হচ্ছে…",
  emptyTitle: "এখনো দেখানোর মতো data নেই",
  emptyBody:
    "একটি Focus Session শেষ করুন বা অভ্যাস লিখুন; অগ্রগতি এখানে দেখা যাবে।",
  errorTitle: "Analytics এখন দেখানো যাচ্ছে না",
  retry: "আবার চেষ্টা করুন",
  signInTitle: "Analytics দেখতে sign in করুন",
  signIn: "Sign in",
  partial: "কিছু source এখনো হালনাগাদ হয়নি; দেখানো ফল আংশিক হতে পারে।",
  timezoneFallback:
    "পুরোনো কিছু Goal check-in-এ historical timezone ছিল না; বর্তমান timezone ব্যবহার করা হয়েছে।",
  asOf: (value: string) => `হালনাগাদ: ${value}`,
  metricDefinitions: "হিসাবের নিয়ম",
  definitionLabels: {
    focused_seconds:
      "শুধু সম্পন্ন Focus Session-এর completedFocusSeconds যোগ করা হয়; running ও abandoned session বাদ।",
    plan_attainment:
      "সম্পন্ন session-এর Focus সময়কে planned সময় দিয়ে ভাগ করে শতকরা হিসাব করা হয়; প্রদর্শনে সর্বোচ্চ ১০০%।",
    outcome_rate:
      "Outcome লেখা সম্পন্ন session-এর অনুপাত; outcome-এর লেখা কখনো Analytics-এ নকল করা হয় না।",
    habit_completion:
      "সম্পন্ন occurrence-কে due, completed, skipped ও excused occurrence-এর মোট সংখ্যা দিয়ে ভাগ করা হয়।",
    interruptions_self_reported:
      "শুধু আপনার লেখা interruption গোনা হয়; passive tracking নেই এবং note নকল করা হয় না।",
  } as Record<string, string>,
};

const en = {
  eyebrow: "Progress, not judgment",
  title: "Focus Analytics",
  subtitle: "See your working rhythm, then choose one small improvement.",
  start: "Start date",
  end: "End date",
  apply: "View range",
  applying: "Calculating…",
  refresh: "Recalculate",
  focusedTime: "Focused time",
  completedSessions: "Completed Focus Sessions",
  planAttainment: "Plan attainment",
  habitCompletion: "Habit completion",
  activeDays: "Active days",
  goalCheckIns: "Goal check-ins",
  noDenominator: "Not enough data",
  trendTitle: "Daily focus",
  trendDescription: "Time from completed Focus Sessions only.",
  tableView: "Detailed data table",
  date: "Date",
  focusMinutes: "Focus minutes",
  sessions: "Sessions",
  interruptions: "Interruptions",
  habits: "Habits",
  distractionTitle: "Distraction Analytics",
  distractionDescription:
    "Only interruptions you explicitly recorded—never passive tracking.",
  sampleSize: (count: number) => `Sample: ${count} interruptions`,
  notCausation: "This is a pattern, not evidence of causation.",
  category: "Category",
  count: "Count",
  noInterruptions: "No interruptions were recorded in this range.",
  categoryLabels: {
    notification: "Notification",
    phone: "Phone",
    person: "Person",
    thought: "Thought",
    environment: "Environment",
    other: "Other",
  } as Record<string, string>,
  reportsTitle: "Reports and exports",
  reportsDescription:
    "Keep this view as an immutable report or download a privacy-filtered file.",
  saveReport: "Save report",
  savingReport: "Creating report…",
  exportCsv: "Export CSV",
  exportJson: "Export JSON",
  creatingExport: "Creating export…",
  reportSaved: "Report saved.",
  exportReady: "Export ready.",
  download: "Download",
  expires: "Expires",
  privacyTitle: "What is excluded",
  privacyBody:
    "Intent and outcome text, interruption notes, goal or habit notes, journals, reflections, and AI conversations are never stored in Analytics.",
  gamificationTitle: "Optional gamification",
  gamificationDescription:
    "XP and levels are gentle recognition for positive progress. Rest and missed days never reduce XP.",
  enabled: "Enable XP and levels",
  level: (level: number, title: string) => `Level ${level} · ${title}`,
  xp: (value: number) => `${value} XP`,
  savePreference: "Save preference",
  loading: "Building Analytics…",
  emptyTitle: "Nothing to chart yet",
  emptyBody: "Complete a Focus Session or log a habit to see progress here.",
  errorTitle: "Analytics is unavailable",
  retry: "Try again",
  signInTitle: "Sign in to view Analytics",
  signIn: "Sign in",
  partial:
    "Some sources are still catching up, so these results may be partial.",
  timezoneFallback:
    "Some older goal check-ins had no historical timezone; your current timezone was used.",
  asOf: (value: string) => `Updated ${value}`,
  metricDefinitions: "Metric definitions",
  definitionLabels: {
    focused_seconds:
      "Sum of completedFocusSeconds for completed Focus Sessions; running and abandoned sessions are excluded.",
    plan_attainment:
      "Focused seconds divided by planned seconds for completed sessions, displayed at no more than 100%.",
    outcome_rate:
      "Share of completed sessions with an outcome; outcome text is never copied into Analytics.",
    habit_completion:
      "Completed occurrences divided by due, completed, skipped, and excused occurrences.",
    interruptions_self_reported:
      "Only interruptions you record are counted; there is no passive tracking and notes are excluded.",
  } as Record<string, string>,
};

export type AnalyticsCopy = typeof en;
