import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GoogleAuthPanel } from "@/features/auth/ui/auth-forms";
import { isLocale } from "@/i18n/config";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <GoogleAuthPanel locale={locale} intent="sign-up" />;
}
