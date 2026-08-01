import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { CoachWorkspace } from "@/features/ai/ui/coach-workspace";
import { getAICopy } from "@/features/ai/ui/ai-copy";
import { isLocale } from "@/i18n/config";

interface CoachPageProps {
  readonly params: Promise<{ readonly locale: string }>;
}

export async function generateMetadata({
  params,
}: CoachPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = getAICopy(locale);
  return {
    title: copy.pageTitle,
    description: copy.pageDescription,
    robots: { index: false, follow: false, noarchive: true },
  };
}

export default async function CoachPage({ params }: CoachPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <AppShell locale={locale} active="coach">
      <CoachWorkspace locale={locale} />
    </AppShell>
  );
}
