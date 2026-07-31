import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ForgotPasswordForm } from "@/features/auth/ui/auth-forms";
import { isLocale } from "@/i18n/config";

export const metadata: Metadata = { title: "Account recovery" };

export default async function ForgotPasswordPage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <ForgotPasswordForm locale={locale} />;
}
