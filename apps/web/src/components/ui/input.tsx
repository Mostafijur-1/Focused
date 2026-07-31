import type * as React from "react";

import { cn } from "@/lib/utils";

export type InputProps = React.ComponentProps<"input">;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/20 h-12 w-full rounded-xl border px-4 text-base shadow-[var(--shadow-xs)] transition-[border-color,box-shadow] outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
