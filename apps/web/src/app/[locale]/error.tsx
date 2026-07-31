"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { isLocale } from "@/i18n/config";
import { getSiteCopy } from "@/i18n/site-copy";

interface ErrorPageProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const params = useParams<{ locale?: string }>();
  const locale =
    params.locale && isLocale(params.locale) ? params.locale : "bn-BD";
  const copy = getSiteCopy(locale);

  useEffect(() => {
    console.error("Rendered route error boundary", { digest: error.digest });
  }, [error]);

  return (
    <main
      id="main-content"
      className="bg-background grid min-h-svh place-items-center px-6"
    >
      <div className="max-w-lg text-center">
        <BrandMark className="justify-center" />
        <h1 className="mt-10 text-3xl font-bold tracking-tight">
          {copy.errorTitle}
        </h1>
        <p className="text-muted-foreground mt-4 leading-7">{copy.errorBody}</p>
        <Button className="mt-7" onClick={reset}>
          {copy.retry}
        </Button>
      </div>
    </main>
  );
}
