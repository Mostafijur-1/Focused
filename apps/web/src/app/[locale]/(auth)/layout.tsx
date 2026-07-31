import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AuthShell } from "@/features/auth/ui/auth-shell";
import { isLocale } from "@/i18n/config";

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true },
};

export default async function AuthenticationLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  readonly params: Promise<{ readonly locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <AuthShell locale={locale}>{children}</AuthShell>;
}
