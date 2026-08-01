import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { MarketingMobileNavigation } from "@/components/shell/marketing-mobile-navigation";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { getAlternateLocale, type Locale } from "@/i18n/config";
import type { SiteCopy } from "@/i18n/site-copy";
import { cn } from "@/lib/utils";

interface MarketingHeaderProps {
  readonly locale: Locale;
  readonly copy: SiteCopy;
}

export function MarketingHeader({ locale, copy }: MarketingHeaderProps) {
  const alternateLocale = getAlternateLocale(locale);

  return (
    <header className="focused-glass sticky top-0 z-50 border-x-0 border-t-0">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href={`/${locale}`} className="rounded-xl" aria-label="Focused">
          <BrandMark compact className="sm:hidden" />
          <BrandMark className="hidden sm:inline-flex" />
        </Link>

        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label={copy.navigationLabel}
        >
          <Link
            className={buttonVariants({ variant: "ghost", size: "compact" })}
            href={`/${locale}#features`}
          >
            {copy.features}
          </Link>
          <Link
            className={buttonVariants({ variant: "ghost", size: "compact" })}
            href={`/${locale}#principles`}
          >
            {copy.principles}
          </Link>
          <Link
            className={buttonVariants({ variant: "ghost", size: "compact" })}
            href="/api/v1/health"
          >
            API
          </Link>
        </nav>

        <div className="flex items-center gap-1">
          <a
            href={`/${alternateLocale}`}
            hrefLang={alternateLocale}
            lang={alternateLocale}
            className={cn(
              buttonVariants({ variant: "ghost", size: "compact" }),
              "min-w-16",
            )}
          >
            {copy.alternateLanguageName}
          </a>
          <ThemeToggle
            lightLabel={copy.lightTheme}
            darkLabel={copy.darkTheme}
          />
          <Link
            href={`/${locale}/sign-in`}
            className={cn(
              buttonVariants({ variant: "outline", size: "compact" }),
              "hidden sm:inline-flex",
            )}
          >
            {copy.signIn}
          </Link>
          <MarketingMobileNavigation locale={locale} copy={copy} />
        </div>
      </div>
    </header>
  );
}
