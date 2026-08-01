import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { AnalyticsWorkspace } from "@/features/analytics/ui/analytics-workspace";
import { getAnalyticsCopy } from "@/features/analytics/ui/analytics-copy";
import { isLocale } from "@/i18n/config";

interface AnalyticsPageProps {
  readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: AnalyticsPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = getAnalyticsCopy(locale);
  return {
    title: copy.title,
    description: copy.subtitle,
    robots: { index: false, follow: false, noarchive: true },
  };
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <AppShell locale={locale} active="analytics">
      <AnalyticsWorkspace locale={locale} />
    </AppShell>
  );
}
