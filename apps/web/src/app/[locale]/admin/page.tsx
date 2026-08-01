import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { AdminWorkspace } from "@/features/admin/ui/admin-workspace";
import { getAdminCopy } from "@/features/admin/ui/admin-copy";
import { isLocale } from "@/i18n/config";

interface AdminPageProps {
  readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: AdminPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = getAdminCopy(locale);
  return {
    title: `${copy.title} | Focused`,
    description: copy.subtitle,
    robots: { index: false, follow: false, noarchive: true },
  };
}

export default async function AdminPage({ params }: AdminPageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <AppShell locale={locale} active="admin">
      <AdminWorkspace locale={locale} />
    </AppShell>
  );
}
