import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SignInForm } from "@/features/auth/ui/auth-forms";
import { isLocale } from "@/i18n/config";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <SignInForm locale={locale} />;
}
