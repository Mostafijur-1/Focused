import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ResetPasswordForm } from "@/features/auth/ui/auth-forms";
import { isLocale } from "@/i18n/config";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <ResetPasswordForm locale={locale} />;
}
