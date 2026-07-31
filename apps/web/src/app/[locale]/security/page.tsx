import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BrandMark } from "@/components/brand/brand-mark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { SecuritySessions } from "@/features/auth/ui/security-sessions";
import { isLocale } from "@/i18n/config";
import { getSiteCopy } from "@/i18n/site-copy";

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
  const site = getSiteCopy(locale);
  return (
    <main id="main-content" className="bg-background min-h-svh">
      <header className="border-border bg-card/80 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href={`/${locale}`} aria-label="Focused">
            <BrandMark />
          </Link>
          <ThemeToggle
            lightLabel={site.lightTheme}
            darkLabel={site.darkTheme}
          />
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <SecuritySessions locale={locale} />
      </div>
    </main>
  );
}
