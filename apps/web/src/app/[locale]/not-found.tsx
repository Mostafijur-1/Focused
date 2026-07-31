import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="bg-background grid min-h-svh place-items-center px-6"
    >
      <div className="max-w-lg text-center">
        <BrandMark className="justify-center" />
        <p className="mt-10 text-sm font-bold text-[var(--primary-text)]">
          404
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          পাতাটি পাওয়া যায়নি
        </h1>
        <p className="text-muted-foreground mt-4 leading-7">
          ঠিকানাটি যাচাই করুন অথবা মূল পাতায় ফিরে যান।
        </p>
        <Link
          href="/bn-BD"
          className={`${buttonVariants({ variant: "primary" })} mt-7`}
        >
          মূল পাতায় ফিরে যান
        </Link>
      </div>
    </main>
  );
}
