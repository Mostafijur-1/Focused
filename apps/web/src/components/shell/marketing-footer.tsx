import { BrandMark } from "@/components/brand/brand-mark";
import type { SiteCopy } from "@/i18n/site-copy";

interface MarketingFooterProps {
  readonly copy: SiteCopy;
}

export function MarketingFooter({ copy }: MarketingFooterProps) {
  return (
    <footer className="border-border border-t py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="space-y-2">
          <BrandMark />
          <p className="text-muted-foreground text-sm">{copy.footerTagline}</p>
        </div>
        <p className="text-muted-foreground text-sm">
          © {new Date().getUTCFullYear()} {copy.copyright}
        </p>
      </div>
    </footer>
  );
}
