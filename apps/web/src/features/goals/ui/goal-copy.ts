import type { Locale } from "@/i18n/config";

const copy = {
  "bn-BD": {
    pageTitle: "লক্ষ্য ও Life Vision",
    pageDescription:
      "দীর্ঘমেয়াদি লক্ষ্যকে পরিমাপযোগ্য অগ্রগতি ও সাপ্তাহিক কাজে রূপ দিন।",
    eyebrow: "দিক থেকে দৈনন্দিন কাজ",
    intro:
      "যে লক্ষ্য আজকের সিদ্ধান্ত বদলায় না, সেটি এখনো পরিকল্পনা নয়। ছোট রাখুন, নিয়মিত দেখুন।",
    newGoal: "নতুন লক্ষ্য",
    cancel: "বাতিল",
    save: "লক্ষ্য সংরক্ষণ করুন",
    title: "লক্ষ্যের নাম",
    description: "কেন এটি গুরুত্বপূর্ণ?",
    horizon: "সময়সীমার ধরন",
    targetDate: "লক্ষ্য পূরণের তারিখ",
    progress: "বর্তমান অগ্রগতি (%)",
    goals: "আপনার লক্ষ্য",
    emptyTitle: "এখনো কোনো লক্ষ্য নেই",
    emptyBody:
      "একটি অর্থবহ লক্ষ্য দিয়ে শুরু করুন। পরে এটিকে Milestone ও সাপ্তাহিক কাজে ভাঙতে পারবেন।",
    signInTitle: "লক্ষ্য দেখতে Sign in করুন",
    signInBody:
      "Life Vision ও লক্ষ্য ব্যক্তিগত; তাই এগুলো কেবল আপনার account-এ দেখা যায়।",
    signIn: "Sign in",
    loading: "লক্ষ্যগুলো প্রস্তুত হচ্ছে",
    retry: "আবার চেষ্টা করুন",
    unavailable: "এই মুহূর্তে লক্ষ্য আনা যাচ্ছে না।",
    cached: "Network নেই—শেষ দেখা তথ্য দেখানো হচ্ছে। পরিবর্তন করতে online হন।",
    overdue: "সময় পেরিয়েছে",
    checkIn: "অগ্রগতি লিখুন",
    activate: "শুরু করুন",
    pause: "বিরতি দিন",
    complete: "সম্পন্ন করুন",
    archive: "Archive করুন",
    lifeVision: "Life Vision",
    visionIntro:
      "কেমন জীবন গড়তে চান, কোন মূল্যবোধে চলবেন এবং কোন পথে যাবেন না—নিজের ভাষায় লিখুন।",
    narrative: "আপনার কাঙ্ক্ষিত জীবনের ছবি",
    values: "মূল্যবোধ (কমা দিয়ে আলাদা করুন)",
    antiGoals: "যে জীবন বা আচরণ এড়াতে চান",
    areaTitle: "জীবনের একটি ক্ষেত্র",
    areaStatement: "এই ক্ষেত্রের কাঙ্ক্ষিত অবস্থা",
    saveDraft: "Draft সংরক্ষণ করুন",
    publish: "এই revision প্রকাশ করুন",
    saved: "পরিবর্তন সংরক্ষিত হয়েছে।",
    confirmComplete: "লক্ষ্যটি সত্যিই সম্পন্ন হয়েছে নিশ্চিত করুন",
  },
  en: {
    pageTitle: "Goals and Life Vision",
    pageDescription:
      "Turn long-term direction into measurable progress and weekly action.",
    eyebrow: "From direction to daily action",
    intro:
      "A goal that does not shape today's decisions is not a plan yet. Keep it small and review it often.",
    newGoal: "New goal",
    cancel: "Cancel",
    save: "Save goal",
    title: "Goal title",
    description: "Why does it matter?",
    horizon: "Horizon",
    targetDate: "Target date",
    progress: "Current progress (%)",
    goals: "Your goals",
    emptyTitle: "No goals yet",
    emptyBody:
      "Start with one meaningful goal. You can break it into milestones and weekly action later.",
    signInTitle: "Sign in to see your goals",
    signInBody: "Life Vision and goals are private to your account.",
    signIn: "Sign in",
    loading: "Preparing your goals",
    retry: "Try again",
    unavailable: "Goals are unavailable right now.",
    cached:
      "You are offline—showing the last viewed data. Go online to make changes.",
    overdue: "Overdue",
    checkIn: "Record progress",
    activate: "Activate",
    pause: "Pause",
    complete: "Complete",
    archive: "Archive",
    lifeVision: "Life Vision",
    visionIntro:
      "Describe the life you want, the values you follow, and the paths you will avoid.",
    narrative: "The life you want to build",
    values: "Values (comma separated)",
    antiGoals: "Lives or behaviors you want to avoid",
    areaTitle: "A life area",
    areaStatement: "Desired state for this area",
    saveDraft: "Save draft",
    publish: "Publish this revision",
    saved: "Changes saved.",
    confirmComplete: "Confirm that this goal is genuinely complete",
  },
} as const;

export function getGoalCopy(locale: Locale) {
  return copy[locale];
}
export type GoalCopy = ReturnType<typeof getGoalCopy>;
