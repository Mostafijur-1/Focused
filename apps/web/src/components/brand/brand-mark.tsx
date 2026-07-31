import { cn } from "@/lib/utils";

interface BrandMarkProps {
  readonly className?: string;
  readonly compact?: boolean;
}

export function BrandMark({ className, compact = false }: BrandMarkProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label="Focused"
    >
      <svg className="size-8" viewBox="0 0 32 32" role="img" aria-hidden="true">
        <defs>
          <linearGradient
            id="focused-mark"
            x1="4"
            y1="4"
            x2="28"
            y2="28"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="var(--primary)" />
            <stop offset="1" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        <rect
          x="2"
          y="2"
          width="28"
          height="28"
          rx="9"
          fill="url(#focused-mark)"
        />
        <path
          d="M11 9.5h11v4H15v3h6v4h-6v5h-4v-16Z"
          fill="var(--primary-foreground)"
        />
      </svg>
      {!compact && (
        <span className="text-lg font-bold tracking-[-0.025em]">Focused</span>
      )}
    </span>
  );
}
