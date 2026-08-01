import {
  CalendarDays,
  ListChecks,
  LayoutDashboard,
  MessagesSquare,
  Target,
  TimerReset,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { Locale } from "@/i18n/config";
import { getSiteCopy } from "@/i18n/site-copy";
import { cn } from "@/lib/utils";

const navigation = [
  { key: "dashboard", icon: LayoutDashboard, available: true },
  { key: "focus", icon: TimerReset, available: true },
  { key: "coach", icon: MessagesSquare, available: true },
  { key: "habits", icon: ListChecks, available: true },
  { key: "goals", icon: Target, available: true },
  { key: "week", icon: CalendarDays, available: true },
] as const;

interface AppShellProps {
  readonly children: ReactNode;
  readonly locale: Locale;
  readonly active: (typeof navigation)[number]["key"];
}

export function AppShell({ children, locale, active }: AppShellProps) {
  const copy = shellCopy[locale];
  const site = getSiteCopy(locale);

  return (
    <div className="bg-background min-h-svh">
      <aside
        className="border-sidebar-border bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-40 hidden border-r p-3 md:block md:w-20 lg:w-64 lg:p-4"
        aria-label={copy.sidebarLabel}
      >
        <Link
          href={`/${locale}/dashboard` as Route}
          className="flex min-h-12 items-center justify-center px-1 lg:justify-start lg:px-2"
          aria-label="Focused Dashboard"
        >
          <BrandMark className="max-md:[&_span]:sr-only" />
        </Link>
        <nav className="mt-6 space-y-1" aria-label={copy.navigationLabel}>
          {navigation.map((item) => (
            <NavigationItem
              key={item.key}
              active={item.key === active}
              available={item.available}
              href={`/${locale}/${item.key}` as Route}
              icon={item.icon}
              label={copy[item.key]}
              comingSoon={copy.comingSoon}
            />
          ))}
        </nav>
        <div className="absolute right-0 bottom-5 left-0 flex justify-center lg:justify-start lg:px-6">
          <ThemeToggle
            lightLabel={site.lightTheme}
            darkLabel={site.darkTheme}
          />
        </div>
      </aside>

      <main id="main-content" className="pb-24 md:ml-20 md:pb-0 lg:ml-64">
        {children}
      </main>

      <nav
        className="focused-glass fixed inset-x-0 bottom-0 z-40 grid min-h-18 grid-cols-6 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label={copy.mobileNavigationLabel}
      >
        {navigation.map((item) => (
          <NavigationItem
            key={item.key}
            active={item.key === active}
            available={item.available}
            href={`/${locale}/${item.key}` as Route}
            icon={item.icon}
            label={copy[item.key]}
            comingSoon={copy.comingSoon}
            mobile
          />
        ))}
      </nav>
    </div>
  );
}

interface NavigationItemProps {
  readonly active: boolean;
  readonly available: boolean;
  readonly href: Route;
  readonly icon: typeof LayoutDashboard;
  readonly label: string;
  readonly comingSoon: string;
  readonly mobile?: boolean;
}

function NavigationItem({
  active,
  available,
  href,
  icon: Icon,
  label,
  comingSoon,
  mobile = false,
}: NavigationItemProps) {
  const className = cn(
    mobile
      ? "flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[0.6875rem]"
      : "flex min-h-11 items-center justify-center gap-3 rounded-xl px-3 text-sm font-medium lg:justify-start",
    active
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-muted-foreground",
    !available && "opacity-55",
  );
  const content = (
    <>
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <span className={cn("truncate", !mobile && "md:sr-only lg:not-sr-only")}>
        {label}
      </span>
      {!available && <span className="sr-only">— {comingSoon}</span>}
    </>
  );
  return available ? (
    <Link
      href={href}
      className={className}
      aria-current={active ? "page" : undefined}
    >
      {content}
    </Link>
  ) : (
    <span className={className} aria-disabled="true">
      {content}
    </span>
  );
}

const shellCopy = {
  "bn-BD": {
    sidebarLabel: "অ্যাপ সাইডবার",
    navigationLabel: "অ্যাপ নেভিগেশন",
    mobileNavigationLabel: "মোবাইল নেভিগেশন",
    dashboard: "Dashboard",
    focus: "Focus",
    coach: "AI Coach",
    habits: "অভ্যাস",
    goals: "লক্ষ্য",
    week: "সপ্তাহ",
    comingSoon: "শিগগিরই আসছে",
  },
  en: {
    sidebarLabel: "Application sidebar",
    navigationLabel: "Application navigation",
    mobileNavigationLabel: "Mobile navigation",
    dashboard: "Dashboard",
    focus: "Focus",
    coach: "AI Coach",
    habits: "Habits",
    goals: "Goals",
    week: "Week",
    comingSoon: "Coming soon",
  },
} as const;
