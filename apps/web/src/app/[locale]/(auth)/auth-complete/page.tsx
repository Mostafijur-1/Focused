import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AuthComplete } from "@/features/auth/ui/auth-forms";
import { isLocale } from "@/i18n/config";

export const metadata: Metadata = { title: "Completing sign in" };

export default async function AuthCompletePage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <AuthComplete locale={locale} />;
}
