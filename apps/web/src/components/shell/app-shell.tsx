import {
  BarChart3,
  CalendarDays,
  CircleUserRound,
  LayoutDashboard,
  ListTodo,
} from "lucide-react";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "আজ", icon: ListTodo },
  { label: "সপ্তাহ", icon: CalendarDays },
  { label: "বিশ্লেষণ", icon: BarChart3 },
  { label: "প্রোফাইল", icon: CircleUserRound },
] as const;

interface AppShellProps {
  readonly children: ReactNode;
  readonly activeLabel?: (typeof navigation)[number]["label"];
}

export function AppShell({
  children,
  activeLabel = "Dashboard",
}: AppShellProps) {
  return (
    <div className="bg-background min-h-svh">
      <aside className="border-sidebar-border bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-40 hidden w-60 border-r p-4 lg:block">
        <BrandMark className="px-2 py-3" />
        <nav className="mt-6 space-y-1" aria-label="অ্যাপ নেভিগেশন">
          {navigation.map((item) => (
            <span
              key={item.label}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium",
                item.label === activeLabel
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" aria-hidden="true" />
              {item.label}
            </span>
          ))}
        </nav>
      </aside>
      <main className="pb-20 lg:ml-60 lg:pb-0">{children}</main>
      <nav
        className="focused-glass fixed inset-x-0 bottom-0 z-40 grid h-18 grid-cols-5 border-x-0 border-b-0 lg:hidden"
        aria-label="মোবাইল নেভিগেশন"
      >
        {navigation.map((item) => (
          <span
            key={item.label}
            className={cn(
              "flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[0.6875rem]",
              item.label === activeLabel
                ? "text-[var(--primary-text)]"
                : "text-muted-foreground",
            )}
          >
            <item.icon className="size-5" aria-hidden="true" />
            <span className="max-w-full truncate">{item.label}</span>
          </span>
        ))}
      </nav>
    </div>
  );
}
