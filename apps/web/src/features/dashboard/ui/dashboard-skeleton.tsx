import { cn } from "@/lib/utils";

import type { DashboardCopy } from "./dashboard-copy";

export function DashboardSkeleton({ copy }: { readonly copy: DashboardCopy }) {
  return (
    <div
      className="mx-auto max-w-[100rem] px-4 py-8 sm:px-6 xl:px-8"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">
        {copy.loading}. {copy.loadingDescription}
      </span>
      <div className="bg-muted h-4 w-24 animate-pulse rounded motion-reduce:animate-none" />
      <div className="bg-muted mt-3 h-10 w-72 max-w-full animate-pulse rounded-xl motion-reduce:animate-none" />
      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-12">
        <SkeletonCard className="h-80 md:col-span-2 xl:col-span-8" />
        <SkeletonCard className="h-80 xl:col-span-4" />
        <SkeletonCard className="h-52 xl:col-span-6" />
        <SkeletonCard className="h-52 xl:col-span-6" />
      </div>
    </div>
  );
}

function SkeletonCard({ className }: { readonly className: string }) {
  return (
    <div
      className={cn(
        "border-border bg-card animate-pulse rounded-2xl border motion-reduce:animate-none",
        className,
      )}
      aria-hidden="true"
    />
  );
}
