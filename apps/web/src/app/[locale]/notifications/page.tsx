import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { NotificationCenter } from "@/features/notifications/ui/notification-center";
import { isLocale, type Locale } from "@/i18n/config";

interface PageProps {
  readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const bangla = locale === "bn-BD";
  return {
    title: bangla
      ? "Notification ও Reminder | Focused"
      : "Notifications and Reminders | Focused",
    description: bangla
      ? "শান্ত, ব্যক্তিগত ও পছন্দ-অনুযায়ী Notification এবং Reminder পরিচালনা করুন।"
      : "Manage calm, private, preference-aware notifications and reminders.",
    robots: { index: false, follow: false },
  };
}

export default async function NotificationsPage({ params }: PageProps) {
  const { locale: candidate } = await params;
  if (!isLocale(candidate)) notFound();
  const locale: Locale = candidate;
  return (
    <AppShell locale={locale} active="notifications">
      <NotificationCenter locale={locale} />
    </AppShell>
  );
}
