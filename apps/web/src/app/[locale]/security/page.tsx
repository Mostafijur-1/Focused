import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { SecuritySessions } from "@/features/auth/ui/security-sessions";
import { isLocale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "Security",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function SecurityPage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <AppShell locale={locale} active="security">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <SecuritySessions locale={locale} />
      </div>
    </AppShell>
  );
}
