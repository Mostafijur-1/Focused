import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-180 ease-out disabled:pointer-events-none disabled:opacity-50 active:translate-y-px motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-[var(--shadow-brand)] hover:bg-[var(--primary-hover)]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-muted",
        outline:
          "border border-border bg-card text-card-foreground shadow-[var(--shadow-xs)] hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        destructive:
          "bg-destructive text-destructive-foreground hover:opacity-90",
      },
      size: {
        default: "h-11",
        compact: "h-9 min-h-9 rounded-lg px-3",
        large: "h-13 min-h-13 rounded-2xl px-7 text-base",
        icon: "size-11 px-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {}

export function Button({
  className,
  type = "button",
  variant,
  size,
  ...props
}: ButtonProps) {
  return (
    <button
      data-slot="button"
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
