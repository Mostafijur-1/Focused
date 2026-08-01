import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getGoalCopy } from "@/features/goals/ui/goal-copy";
import { Goals } from "@/features/goals/ui/goals";
import { isLocale } from "@/i18n/config";
interface Props {
  readonly params: Promise<{ locale: string }>;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = getGoalCopy(locale);
  return {
    title: copy.pageTitle,
    description: copy.pageDescription,
    robots: { index: false, follow: false, noarchive: true },
  };
}
export default async function GoalsPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <AppShell locale={locale} active="goals">
      <Goals locale={locale} />
    </AppShell>
  );
}
