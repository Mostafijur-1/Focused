import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { Habits } from "@/features/habits/ui/habits";
import { getHabitCopy } from "@/features/habits/ui/habit-copy";
import { isLocale } from "@/i18n/config";

interface HabitPageProps {
  readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: HabitPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = getHabitCopy(locale);
  return {
    title: copy.pageTitle,
    description: copy.pageDescription,
    robots: { index: false, follow: false, noarchive: true },
  };
}

export default async function HabitPage({ params }: HabitPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <AppShell locale={locale} active="habits">
      <Habits locale={locale} />
    </AppShell>
  );
}
