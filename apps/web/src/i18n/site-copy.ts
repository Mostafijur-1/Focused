import type { Locale } from "./config";

const bnBD = {
  openMenu: "মেনু খুলুন",
  closeMenu: "মেনু বন্ধ করুন",
  accountActions: "অ্যাকাউন্টের বিকল্প",
  createAccount: "অ্যাকাউন্ট তৈরি করুন",
  languageName: "বাংলা",
  alternateLanguageName: "English",
  skipToContent: "মূল অংশে যান",
  navigationLabel: "প্রধান নেভিগেশন",
  features: "সুবিধাগুলো",
  principles: "আমাদের নীতি",
  documentation: "ডকুমেন্টেশন",
  signIn: "প্রবেশ করুন",
  theme: "থিম পরিবর্তন করুন",
  lightTheme: "হালকা থিম ব্যবহার করুন",
  darkTheme: "গাঢ় থিম ব্যবহার করুন",
  systemTheme: "ডিভাইসের থিম ব্যবহার করুন",
  eyebrow: "আপনার ব্যক্তিগত FocusOS",
  title: "মনোযোগ ধরে রাখুন। প্রতিদিন একটু করে এগিয়ে যান।",
  subtitle:
    "Focused আপনার পরিকল্পনা, Focus Session, অভ্যাস ও অগ্রগতিকে এক জায়গায় আনে—যাতে গুরুত্বপূর্ণ কাজটি পরিষ্কার থাকে এবং অপ্রয়োজনীয় চাপ কমে।",
  primaryAction: "বিনামূল্যে শুরু করুন",
  secondaryAction: "কীভাবে কাজ করে দেখুন",
  privacyNote:
    "আপনার তথ্য ব্যক্তিগত। AI কেবল আপনার স্পষ্ট অনুমতিতেই নির্ধারিত তথ্য ব্যবহার করবে।",
  previewLabel: "আজকের অগ্রাধিকার",
  previewTitle: "প্রস্তাবনার প্রথম খসড়া শেষ করুন",
  previewTime: "সকাল ৯:৩০ · ৫০ মিনিট",
  previewAction: "Focus Session শুরু করুন",
  featureHeading: "কম বিচ্যুতি, বেশি অর্থপূর্ণ অগ্রগতি",
  featureIntro:
    "প্রতিটি অংশ একটি সহজ প্রশ্নের উত্তর দেয়: এখন আমার সবচেয়ে গুরুত্বপূর্ণ কাজ কী?",
  focusTitle: "গভীরভাবে কাজ করুন",
  focusBody:
    "Timer চালু করুন, বিঘ্ন নথিভুক্ত করুন এবং Focus Session শেষে কী অর্জিত হয়েছে তা লিখে রাখুন।",
  planTitle: "বাস্তবসম্মত পরিকল্পনা করুন",
  planBody:
    "নিজের সময় ও সামর্থ্য অনুযায়ী অগ্রাধিকার ঠিক করুন। অতিরিক্ত কাজ চাপিয়ে না দিয়ে গুরুত্বপূর্ণ ফলাফলে মন দিন।",
  coachTitle: "AI কোচের সঙ্গে ভাবুন",
  coachBody:
    "আপনার অনুমোদিত তথ্য থেকে ব্যাখ্যাসহ পরামর্শ নিন। কোনো পরিবর্তন কার্যকর হওয়ার আগে সিদ্ধান্ত আপনারই থাকবে।",
  principleHeading: "মনোযোগের পক্ষে তৈরি",
  principleBody:
    "Focused ব্যস্ত দেখানোর জন্য নয়। এটি আপনাকে কম কাজ বেছে নিতে, মন দিয়ে শেষ করতে এবং অভিজ্ঞতা থেকে শিখতে সাহায্য করে।",
  principleOne: "একটি স্পষ্ট প্রধান কাজ",
  principleTwo: "চাপ নয়, সচেতন অগ্রগতি",
  principleThree: "ব্যক্তিগত তথ্য শুরু থেকেই সুরক্ষিত",
  footerTagline: "শান্ত মনোযোগ। দৃশ্যমান অগ্রগতি।",
  copyright: "Focused। সর্বস্বত্ব সংরক্ষিত।",
  unavailableTitle: "পাতাটি পাওয়া যায়নি",
  unavailableBody: "ঠিকানাটি যাচাই করুন অথবা মূল পাতায় ফিরে যান।",
  backHome: "মূল পাতায় ফিরে যান",
  errorTitle: "কিছু একটা ঠিকমতো কাজ করেনি",
  errorBody: "আপনার তথ্য নিরাপদ আছে। একটু পর আবার চেষ্টা করুন।",
  retry: "আবার চেষ্টা করুন",
  loading: "পাতাটি প্রস্তুত হচ্ছে…",
} as const;

export type SiteCopy = { readonly [Key in keyof typeof bnBD]: string };

const english: SiteCopy = {
  openMenu: "Open menu",
  closeMenu: "Close menu",
  accountActions: "Account options",
  createAccount: "Create account",
  languageName: "English",
  alternateLanguageName: "বাংলা",
  skipToContent: "Skip to main content",
  navigationLabel: "Primary navigation",
  features: "Features",
  principles: "Our principles",
  documentation: "Documentation",
  signIn: "Sign in",
  theme: "Change theme",
  lightTheme: "Use light theme",
  darkTheme: "Use dark theme",
  systemTheme: "Use device theme",
  eyebrow: "Your personal FocusOS",
  title: "Protect your attention. Make meaningful progress every day.",
  subtitle:
    "Focused brings your plans, Focus Sessions, habits, and progress into one calm place—so the important work stays clear and unnecessary pressure stays low.",
  primaryAction: "Start for free",
  secondaryAction: "See how it works",
  privacyNote:
    "Your data is private. AI uses selected information only with your explicit permission.",
  previewLabel: "Today’s priority",
  previewTitle: "Finish the first proposal draft",
  previewTime: "9:30 AM · 50 minutes",
  previewAction: "Start Focus Session",
  featureHeading: "Less distraction, more meaningful progress",
  featureIntro:
    "Every part answers one simple question: what is the most important thing for me to do now?",
  focusTitle: "Work deeply",
  focusBody:
    "Start a Timer, record interruptions, and capture what the Focus Session achieved when it ends.",
  planTitle: "Plan realistically",
  planBody:
    "Choose priorities around your actual time and capacity. Focus on meaningful outcomes without overloading the day.",
  coachTitle: "Think with an AI coach",
  coachBody:
    "Receive explainable suggestions from information you approve. You stay in control before any change is applied.",
  principleHeading: "Designed in favor of attention",
  principleBody:
    "Focused is not built to make you look busy. It helps you choose less, finish with care, and learn from experience.",
  principleOne: "One clear primary action",
  principleTwo: "Intentional progress without pressure",
  principleThree: "Private by design from the start",
  footerTagline: "Quiet focus. Visible progress.",
  copyright: "Focused. All rights reserved.",
  unavailableTitle: "Page not found",
  unavailableBody: "Check the address or return to the home page.",
  backHome: "Return home",
  errorTitle: "Something did not work as expected",
  errorBody: "Your information is safe. Please try again in a moment.",
  retry: "Try again",
  loading: "Preparing the page…",
};

const copy: Readonly<Record<Locale, SiteCopy>> = {
  "bn-BD": bnBD,
  en: english,
};

export function getSiteCopy(locale: Locale): SiteCopy {
  return copy[locale];
}
