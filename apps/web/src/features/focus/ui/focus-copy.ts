import type { InterruptionCategory } from "@/features/focus/domain/focus-types";
import type { Locale } from "@/i18n/config";

export interface FocusCopy {
  readonly pageTitle: string;
  readonly pageDescription: string;
  readonly signInTitle: string;
  readonly signInDescription: string;
  readonly signInAction: string;
  readonly loading: string;
  readonly retry: string;
  readonly startTitle: string;
  readonly startDescription: string;
  readonly intent: string;
  readonly intentPlaceholder: string;
  readonly mode: string;
  readonly deepWork: string;
  readonly pomodoro: string;
  readonly custom: string;
  readonly duration: string;
  readonly minutes: string;
  readonly linkedGoal: string;
  readonly noGoal: string;
  readonly begin: string;
  readonly starting: string;
  readonly focusPhase: string;
  readonly shortBreak: string;
  readonly longBreak: string;
  readonly running: string;
  readonly paused: string;
  readonly overtime: string;
  readonly cycle: (current: number, total: number) => string;
  readonly pause: string;
  readonly resume: string;
  readonly addFive: string;
  readonly interruption: string;
  readonly complete: string;
  readonly abandon: string;
  readonly nextInterval: string;
  readonly skipBreak: string;
  readonly outcomeTitle: string;
  readonly outcomeLabel: string;
  readonly outcomePlaceholder: string;
  readonly confirmComplete: string;
  readonly confirmAbandon: string;
  readonly cancel: string;
  readonly interruptionTitle: string;
  readonly interruptionNote: string;
  readonly record: string;
  readonly recentTitle: string;
  readonly recentEmpty: string;
  readonly focusedFor: (minutes: number) => string;
  readonly interruptions: (count: number) => string;
  readonly offline: string;
  readonly queued: string;
  readonly changedElsewhere: string;
  readonly genericError: string;
  readonly timerReady: string;
  readonly noBackgroundPromise: string;
  readonly pomodoroSettings: string;
  readonly focusMinutes: string;
  readonly shortBreakMinutes: string;
  readonly longBreakMinutes: string;
  readonly cycles: string;
  readonly autoStartBreaks: string;
  readonly autoStartFocus: string;
  readonly sound: string;
  readonly vibration: string;
  readonly preset: string;
  readonly customPreset: string;
  readonly savePreset: string;
  readonly presetName: string;
  readonly interruptionLabels: Readonly<Record<InterruptionCategory, string>>;
}

const bangla: FocusCopy = {
  pageTitle: "Focus Timer",
  pageDescription:
    "সময় গোনার চেয়ে গুরুত্বপূর্ণ হলো—কোন কাজে মন দিচ্ছেন, সেটা পরিষ্কার রাখা।",
  signInTitle: "Focus Session শুরু করতে Sign in করুন",
  signInDescription:
    "আপনার Timer state ব্যক্তিগত এবং authenticated device-গুলোর মধ্যে নিরাপদে sync হয়।",
  signInAction: "Sign in করুন",
  loading: "Focus Timer প্রস্তুত হচ্ছে…",
  retry: "আবার চেষ্টা করুন",
  startTitle: "একটি শান্ত Focus Session শুরু করুন",
  startDescription:
    "একটি স্পষ্ট কাজ বেছে নিন। প্রয়োজন হলে সময় পরে বাড়াতে পারবেন।",
  intent: "এই Session-এ কী করবেন?",
  intentPlaceholder: "যেমন: API authentication flow শেষ করব",
  mode: "Focus পদ্ধতি",
  deepWork: "Deep Work",
  pomodoro: "Pomodoro",
  custom: "Custom",
  duration: "সময়",
  minutes: "মিনিট",
  linkedGoal: "Goal-এর সঙ্গে যুক্ত করুন",
  noGoal: "কোনো Goal নয়",
  begin: "Focus শুরু করুন",
  starting: "শুরু হচ্ছে…",
  focusPhase: "Focus",
  shortBreak: "ছোট বিরতি",
  longBreak: "দীর্ঘ বিরতি",
  running: "চলছে",
  paused: "বিরতিতে",
  overtime: "নির্ধারিত সময়ের বাইরে",
  cycle: (current, total) => `Cycle ${current}/${total}`,
  pause: "বিরতি নিন",
  resume: "আবার শুরু করুন",
  addFive: "+৫ মিনিট",
  interruption: "বিভ্রান্তি লিখুন",
  complete: "Session শেষ করুন",
  abandon: "এখানেই থামুন",
  nextInterval: "পরের interval শুরু করুন",
  skipBreak: "বিরতি এড়িয়ে যান",
  outcomeTitle: "Session-এর ছোট্ট পর্যালোচনা",
  outcomeLabel: "কী এগোল? (ঐচ্ছিক)",
  outcomePlaceholder: "ফলাফল বা পরের পদক্ষেপ লিখুন",
  confirmComplete: "সম্পন্ন হিসেবে রাখুন",
  confirmAbandon: "থামার সিদ্ধান্ত নিশ্চিত করুন",
  cancel: "ফিরে যান",
  interruptionTitle: "কী মনোযোগ সরিয়েছে?",
  interruptionNote: "ছোট note (ঐচ্ছিক)",
  record: "রেকর্ড করুন",
  recentTitle: "সাম্প্রতিক Session",
  recentEmpty: "এখনও কোনো Focus Session শেষ হয়নি।",
  focusedFor: (minutes) => `${minutes} মিনিট Focus`,
  interruptions: (count) => `${count}টি বিভ্রান্তি`,
  offline:
    "আপনি Offline আছেন। Timer timestamp থেকে ঠিক থাকবে; শেষ করার command সংযোগ ফিরলে sync হবে।",
  queued: "Command নিরাপদে রাখা হয়েছে। Online হলে নিজে থেকেই sync হবে।",
  changedElsewhere:
    "Session-টি অন্য tab বা device-এ বদলেছে। সর্বশেষ state দেখানো হচ্ছে।",
  genericError: "অনুরোধটি শেষ করা যায়নি। আবার চেষ্টা করুন।",
  timerReady: "সময় শেষ। এখন ফলাফল দেখুন বা পরের interval-এ যান।",
  noBackgroundPromise:
    "Browser বন্ধ বা device sleep হলে JavaScript চলার নিশ্চয়তা নেই। ফিরে এলে server time থেকে Timer ঠিক হয়ে যাবে।",
  pomodoroSettings: "Pomodoro সেটিংস",
  focusMinutes: "Focus মিনিট",
  shortBreakMinutes: "ছোট বিরতি",
  longBreakMinutes: "দীর্ঘ বিরতি",
  cycles: "Cycle সংখ্যা",
  autoStartBreaks: "বিরতি নিজে থেকে শুরু",
  autoStartFocus: "পরের Focus নিজে থেকে শুরু",
  sound: "সময় শেষে শব্দ",
  vibration: "Vibration",
  preset: "Preset",
  customPreset: "নিজস্ব সেটিংস",
  savePreset: "এই সেটিংস Preset হিসেবে রাখুন",
  presetName: "Preset-এর নাম",
  interruptionLabels: {
    notification: "Notification",
    phone: "Phone",
    person: "কেউ ডেকেছে",
    thought: "নিজের চিন্তা",
    environment: "পরিবেশ",
    other: "অন্য কিছু",
  },
};

const english: FocusCopy = {
  pageTitle: "Focus Timer",
  pageDescription:
    "A trustworthy timer built around clear intent, recovery, and honest time accounting.",
  signInTitle: "Sign in to start a Focus Session",
  signInDescription:
    "Your timer state is private and securely synchronized across authenticated devices.",
  signInAction: "Sign in",
  loading: "Preparing Focus Timer…",
  retry: "Try again",
  startTitle: "Start a calm Focus Session",
  startDescription:
    "Choose one clear outcome. You can extend the session later.",
  intent: "What will you do in this session?",
  intentPlaceholder: "For example: finish the API authentication flow",
  mode: "Focus method",
  deepWork: "Deep Work",
  pomodoro: "Pomodoro",
  custom: "Custom",
  duration: "Duration",
  minutes: "minutes",
  linkedGoal: "Link a Goal",
  noGoal: "No Goal",
  begin: "Start Focus",
  starting: "Starting…",
  focusPhase: "Focus",
  shortBreak: "Short break",
  longBreak: "Long break",
  running: "Running",
  paused: "Paused",
  overtime: "Over planned time",
  cycle: (current, total) => `Cycle ${current}/${total}`,
  pause: "Pause",
  resume: "Resume",
  addFive: "+5 minutes",
  interruption: "Log distraction",
  complete: "Complete session",
  abandon: "Stop here",
  nextInterval: "Start next interval",
  skipBreak: "Skip break",
  outcomeTitle: "A short session review",
  outcomeLabel: "What moved forward? (optional)",
  outcomePlaceholder: "Record the outcome or next step",
  confirmComplete: "Mark complete",
  confirmAbandon: "Confirm stopping",
  cancel: "Go back",
  interruptionTitle: "What pulled your attention away?",
  interruptionNote: "Short note (optional)",
  record: "Record",
  recentTitle: "Recent sessions",
  recentEmpty: "No Focus Session has been completed yet.",
  focusedFor: (minutes) => `${minutes} minutes focused`,
  interruptions: (count) => `${count} interruptions`,
  offline:
    "You are offline. Timestamps keep the timer accurate; terminal commands sync when the connection returns.",
  queued: "Command saved safely. It will sync when you are online.",
  changedElsewhere:
    "This session changed in another tab or device. The latest state is now shown.",
  genericError: "The request could not be completed. Try again.",
  timerReady: "Time is up. Review the result or move to the next interval.",
  noBackgroundPromise:
    "Browsers cannot guarantee execution while closed or when a device sleeps. Focused reconciles from server time when you return.",
  pomodoroSettings: "Pomodoro settings",
  focusMinutes: "Focus minutes",
  shortBreakMinutes: "Short break",
  longBreakMinutes: "Long break",
  cycles: "Cycles",
  autoStartBreaks: "Auto-start breaks",
  autoStartFocus: "Auto-start next focus",
  sound: "Sound when time ends",
  vibration: "Vibration",
  preset: "Preset",
  customPreset: "Custom settings",
  savePreset: "Save these settings as a preset",
  presetName: "Preset name",
  interruptionLabels: {
    notification: "Notification",
    phone: "Phone",
    person: "Another person",
    thought: "A thought",
    environment: "Environment",
    other: "Something else",
  },
};

export function getFocusCopy(locale: Locale): FocusCopy {
  return locale === "bn-BD" ? bangla : english;
}
