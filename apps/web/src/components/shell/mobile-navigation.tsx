"use client";

import {
  Bell,
  ChartNoAxesCombined,
  CalendarDays,
  Check,
  LayoutDashboard,
  ListChecks,
  Menu,
  MessagesSquare,
  ShieldCheck,
  Target,
  TimerReset,
  X,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useRef } from "react";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

export type AppNavigationKey =
  | "dashboard"
  | "focus"
  | "coach"
  | "habits"
  | "goals"
  | "week"
  | "notifications"
  | "analytics"
  | "security";

export interface MobileNavigationItem {
  readonly key: AppNavigationKey;
  readonly href: Route;
  readonly label: string;
}

interface MobileNavigationProps {
  readonly active: AppNavigationKey;
  readonly items: readonly MobileNavigationItem[];
  readonly navigationLabel: string;
  readonly moreLabel: string;
  readonly allFeaturesLabel: string;
  readonly closeLabel: string;
  readonly lightThemeLabel: string;
  readonly darkThemeLabel: string;
}

const icons = {
  dashboard: LayoutDashboard,
  focus: TimerReset,
  coach: MessagesSquare,
  habits: ListChecks,
  goals: Target,
  week: CalendarDays,
  notifications: Bell,
  analytics: ChartNoAxesCombined,
  security: ShieldCheck,
} as const satisfies Record<AppNavigationKey, typeof LayoutDashboard>;

const primaryKeys = new Set<AppNavigationKey>([
  "dashboard",
  "focus",
  "habits",
  "goals",
]);

export function MobileNavigation(props: MobileNavigationProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const primaryItems = props.items.filter((item) => primaryKeys.has(item.key));
  const moreActive = !primaryKeys.has(props.active);

  function openMenu() {
    dialogRef.current?.showModal();
  }

  function closeMenu() {
    dialogRef.current?.close();
  }

  return (
    <>
      <nav
        className="focused-glass fixed inset-x-0 bottom-0 z-40 grid min-h-18 grid-cols-5 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label={props.navigationLabel}
      >
        {primaryItems.map((item) => (
          <MobileNavigationLink
            key={item.key}
            item={item}
            active={item.key === props.active}
          />
        ))}
        <button
          type="button"
          className={cn(
            "flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[0.6875rem]",
            moreActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground",
          )}
          aria-haspopup="dialog"
          aria-controls="mobile-feature-menu"
          aria-current={moreActive ? "page" : undefined}
          onClick={openMenu}
        >
          <Menu className="size-5" aria-hidden="true" />
          <span className="truncate">{props.moreLabel}</span>
        </button>
      </nav>

      <dialog
        ref={dialogRef}
        id="mobile-feature-menu"
        className="bg-card text-card-foreground fixed inset-x-0 top-auto bottom-0 m-0 max-h-[min(80svh,42rem)] w-full max-w-none rounded-t-3xl border p-0 shadow-2xl backdrop:bg-black/60 open:flex open:flex-col md:hidden"
        aria-labelledby="mobile-feature-menu-title"
        onClick={(event) => {
          if (event.target === dialogRef.current) closeMenu();
        }}
      >
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-current opacity-20" />
        <header className="flex items-center justify-between gap-4 px-5 py-4">
          <h2 id="mobile-feature-menu-title" className="text-lg font-bold">
            {props.allFeaturesLabel}
          </h2>
          <button
            type="button"
            className="hover:bg-muted grid size-11 place-items-center rounded-xl"
            onClick={closeMenu}
          >
            <X className="size-5" aria-hidden="true" />
            <span className="sr-only">{props.closeLabel}</span>
          </button>
        </header>
        <nav
          className="grid grid-cols-2 gap-2 overflow-y-auto px-4 pb-4"
          aria-label={props.allFeaturesLabel}
        >
          {props.items.map((item) => {
            const Icon = icons[item.key];
            const active = item.key === props.active;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "relative flex min-h-20 items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold",
                  active
                    ? "border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground"
                    : "border-border bg-background hover:bg-muted",
                )}
                aria-current={active ? "page" : undefined}
                onClick={closeMenu}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
                {active && (
                  <Check
                    className="absolute top-2 right-2 size-4"
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-border flex items-center justify-between border-t px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <span className="text-muted-foreground text-sm">
            {props.moreLabel}
          </span>
          <ThemeToggle
            lightLabel={props.lightThemeLabel}
            darkLabel={props.darkThemeLabel}
          />
        </div>
      </dialog>
    </>
  );
}

function MobileNavigationLink({
  item,
  active,
}: {
  readonly item: MobileNavigationItem;
  readonly active: boolean;
}) {
  const Icon = icons[item.key];
  return (
    <Link
      href={item.href}
      className={cn(
        "flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-[0.6875rem]",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
