import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Card } from "@/components/ui/card";
import { getAlternateLocale, type Locale } from "@/i18n/config";
import { getSiteCopy } from "@/i18n/site-copy";

export function AuthShell({
  children,
  locale,
}: {
  readonly children: ReactNode;
  readonly locale: Locale;
}) {
  const site = getSiteCopy(locale);
  const alternate = getAlternateLocale(locale);
  return (
    <main
      id="main-content"
      className="relative grid min-h-svh place-items-center overflow-hidden px-4 py-8 sm:px-6"
    >
      <div
        aria-hidden="true"
        className="page-grid absolute inset-0 opacity-45"
      />
      <div
        aria-hidden="true"
        className="bg-primary/15 absolute -top-32 left-1/2 size-96 -translate-x-1/2 rounded-full blur-3xl"
      />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-5 flex items-center justify-between gap-3 px-1">
          <Link href={`/${locale}`} className="rounded-xl" aria-label="Focused">
            <BrandMark />
          </Link>
          <div className="flex items-center gap-2">
            <a
              href={`/${alternate}/sign-in`}
              hrefLang={alternate}
              className="hover:bg-muted rounded-lg px-3 py-2 text-sm font-semibold"
            >
              {site.alternateLanguageName}
            </a>
            <ThemeToggle
              lightLabel={site.lightTheme}
              darkLabel={site.darkTheme}
            />
          </div>
        </div>
        <Card className="focused-glass p-6 sm:p-8">{children}</Card>
      </div>
    </main>
  );
}
