import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VerifyEmailAction } from "@/features/auth/ui/auth-forms";
import { isLocale } from "@/i18n/config";

export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyEmailPage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <VerifyEmailAction locale={locale} />;
}
