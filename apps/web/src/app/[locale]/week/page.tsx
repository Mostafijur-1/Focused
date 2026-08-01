import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { WeeklyPlan } from "@/features/goals/ui/weekly-plan";
import { isLocale } from "@/i18n/config";
interface Props {
  readonly params: Promise<{ locale: string }>;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const bn = locale === "bn-BD";
  return {
    title: "Weekly Plan",
    description: bn
      ? "সামর্থ্য বুঝে সপ্তাহের গুরুত্বপূর্ণ ফল বেছে নিন।"
      : "Choose the outcomes that matter within a realistic weekly capacity.",
    robots: { index: false, follow: false, noarchive: true },
  };
}
export default async function WeekPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <AppShell locale={locale} active="week">
      <WeeklyPlan locale={locale} />
    </AppShell>
  );
}
