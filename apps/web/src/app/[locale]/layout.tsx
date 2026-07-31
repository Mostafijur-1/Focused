import type { Metadata } from "next";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/features/auth/ui/auth-provider";
import { getServerEnvironment } from "@/lib/config/server-env";
import { isLocale, locales } from "@/i18n/config";
import { getSiteCopy } from "@/i18n/site-copy";

import "../globals.css";

const inter = localFont({
  src: "../../assets/fonts/inter-latin.woff2",
  variable: "--font-inter",
  weight: "100 900",
  style: "normal",
  display: "swap",
});

const notoSansBengali = localFont({
  src: "../../assets/fonts/noto-sans-bengali.woff2",
  variable: "--font-bangla",
  weight: "100 900",
  style: "normal",
  display: "swap",
});

interface LocaleLayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<{ locale: string }>;
}

export function generateStaticParams(): Array<{ locale: string }> {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Pick<LocaleLayoutProps, "params">): Promise<Metadata> {
  const { locale: candidate } = await params;
  const locale = isLocale(candidate) ? candidate : "bn-BD";
  const copy = getSiteCopy(locale);
  const appUrl = getServerEnvironment().NEXT_PUBLIC_APP_URL;

  return {
    metadataBase: new URL(appUrl),
    title: {
      default: "Focused — FocusOS",
      template: "%s · Focused",
    },
    description: copy.subtitle,
    applicationName: "Focused",
    alternates: {
      canonical: `/${locale}`,
      languages: {
        "bn-BD": "/bn-BD",
        en: "/en",
      },
    },
    openGraph: {
      type: "website",
      siteName: "Focused",
      locale: locale === "bn-BD" ? "bn_BD" : "en_US",
      title: "Focused — FocusOS",
      description: copy.subtitle,
      url: `/${locale}`,
    },
    twitter: {
      card: "summary",
      title: "Focused — FocusOS",
      description: copy.subtitle,
    },
    robots: {
      index: true,
      follow: true,
    },
    manifest: "/manifest.webmanifest",
    icons: {
      icon: "/icon.svg",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  const copy = getSiteCopy(locale);

  return (
    <html lang={locale} suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`${inter.variable} ${notoSansBengali.variable}`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <a href="#main-content" className="sr-only-focusable">
            {copy.skipToContent}
          </a>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
