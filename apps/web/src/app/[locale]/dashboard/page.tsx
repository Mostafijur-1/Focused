import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { Dashboard } from "@/features/dashboard/ui/dashboard";
import { getDashboardCopy } from "@/features/dashboard/ui/dashboard-copy";
import { isLocale } from "@/i18n/config";

interface DashboardPageProps {
  readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: DashboardPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = getDashboardCopy(locale);
  return {
    title: copy.pageTitle,
    description: copy.pageDescription,
    robots: { index: false, follow: false, noarchive: true },
  };
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <AppShell locale={locale} active="dashboard">
      <Dashboard locale={locale} />
    </AppShell>
  );
}
