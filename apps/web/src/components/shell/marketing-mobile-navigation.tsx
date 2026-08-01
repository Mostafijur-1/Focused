"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import type { SiteCopy } from "@/i18n/site-copy";
import { cn } from "@/lib/utils";

interface MarketingMobileNavigationProps {
  readonly locale: Locale;
  readonly copy: SiteCopy;
}

export function MarketingMobileNavigation({
  locale,
  copy,
}: MarketingMobileNavigationProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function openMenu() {
    dialogRef.current?.showModal();
  }

  function closeMenu() {
    dialogRef.current?.close();
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label={copy.openMenu}
        aria-haspopup="dialog"
        aria-controls="marketing-mobile-navigation"
        onClick={openMenu}
      >
        <Menu aria-hidden="true" />
      </Button>

      <dialog
        ref={dialogRef}
        id="marketing-mobile-navigation"
        className="bg-card text-card-foreground fixed inset-x-0 top-auto bottom-0 m-0 max-h-[min(85svh,38rem)] w-full max-w-none rounded-t-3xl border p-0 shadow-2xl backdrop:bg-black/60 open:flex open:flex-col md:hidden"
        aria-labelledby="marketing-mobile-navigation-title"
        onClick={(event) => {
          if (event.target === dialogRef.current) closeMenu();
        }}
      >
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-current opacity-20" />
        <header className="flex items-center justify-between gap-4 px-5 py-4">
          <h2
            id="marketing-mobile-navigation-title"
            className="text-lg font-bold"
          >
            {copy.navigationLabel}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label={copy.closeMenu}
            onClick={closeMenu}
          >
            <X aria-hidden="true" />
          </Button>
        </header>

        <nav
          className="grid gap-2 overflow-y-auto px-4 pb-4"
          aria-label={copy.navigationLabel}
        >
          <MobileLink
            href={{ pathname: `/${locale}`, hash: "features" }}
            onClick={closeMenu}
          >
            {copy.features}
          </MobileLink>
          <MobileLink
            href={{ pathname: `/${locale}`, hash: "principles" }}
            onClick={closeMenu}
          >
            {copy.principles}
          </MobileLink>
          <MobileLink href="/api/v1/health" onClick={closeMenu}>
            API
          </MobileLink>
        </nav>

        <div
          className="border-border grid grid-cols-2 gap-3 border-t px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          aria-label={copy.accountActions}
          role="group"
        >
          <Link
            href={`/${locale}/sign-in`}
            className={buttonVariants({ variant: "outline" })}
            onClick={closeMenu}
          >
            {copy.signIn}
          </Link>
          <Link
            href={`/${locale}/sign-up`}
            className={buttonVariants({ variant: "primary" })}
            onClick={closeMenu}
          >
            {copy.createAccount}
          </Link>
        </div>
      </dialog>
    </>
  );
}

function MobileLink({
  className,
  ...props
}: React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        "hover:bg-muted flex min-h-12 items-center rounded-xl px-4 text-sm font-semibold",
        className,
      )}
      {...props}
    />
  );
}
