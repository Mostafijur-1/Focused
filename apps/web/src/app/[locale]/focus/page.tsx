import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { getFocusCopy } from "@/features/focus/ui/focus-copy";
import { FocusTimer } from "@/features/focus/ui/focus-timer";
import { isLocale } from "@/i18n/config";

interface FocusPageProps {
  readonly params: Promise<{ readonly locale: string }>;
}

export async function generateMetadata({
  params,
}: FocusPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = getFocusCopy(locale);
  return {
    title: copy.pageTitle,
    description: copy.pageDescription,
    robots: { index: false, follow: false, noarchive: true },
  };
}

export default async function FocusPage({ params }: FocusPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <AppShell locale={locale} active="focus">
      <FocusTimer locale={locale} />
    </AppShell>
  );
}
