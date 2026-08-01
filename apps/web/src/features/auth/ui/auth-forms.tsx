"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { OAuthProvider } from "@/features/auth/domain/oauth-types";
import type { Locale } from "@/i18n/config";

import { AuthApiError, authFetch } from "./auth-api";
import { getAuthCopy } from "./auth-copy";
import { useAuth } from "./auth-provider";

export type GoogleAuthIntent = "sign-in" | "sign-up";

export function GoogleAuthPanel({
  locale,
  intent,
}: {
  readonly locale: Locale;
  readonly intent: GoogleAuthIntent;
}) {
  const copy = getAuthCopy(locale);
  const isRegistration = intent === "sign-up";

  return (
    <>
      <AuthHeading
        title={isRegistration ? copy.signUpTitle : copy.signInTitle}
        description={
          isRegistration ? copy.signUpDescription : copy.signInDescription
        }
      />
      <GoogleOAuthButton locale={locale} />
      <SecurityNote>{copy.securityNote}</SecurityNote>
    </>
  );
}

export function AuthComplete({ locale }: { readonly locale: Locale }) {
  const copy = getAuthCopy(locale);
  const { refresh } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh().then((session) => {
      if (session) router.replace(`/${locale}/dashboard` as Route);
      else setError(copy.sessionExpired);
    });
  }, [copy.sessionExpired, locale, refresh, router]);

  return (
    <div role="status" aria-live="polite" className="text-center">
      <div className="border-primary/20 border-t-primary mx-auto mb-4 size-8 animate-spin rounded-full border-3 motion-reduce:animate-none" />
      <p>{error ?? copy.authComplete}</p>
    </div>
  );
}

function GoogleOAuthButton({ locale }: { readonly locale: Locale }) {
  const copy = getAuthCopy(locale);
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setPending("google");
    setError(null);
    try {
      const result = await authFetch<{ authorizationUrl: string }>(
        "/api/v1/auth/oauth/google/start",
        {
          method: "POST",
          body: JSON.stringify({
            locale,
            timeZone: browserTimeZone(),
            returnTo: `/${locale}/auth-complete`,
          }),
        },
      );
      window.location.assign(result.authorizationUrl);
    } catch (requestError) {
      setPending(null);
      setError(errorMessage(requestError, copy.unexpected, copy.offline));
    }
  }

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        className="w-full"
        disabled={pending !== null}
        onClick={() => void start()}
      >
        <GoogleMark />
        {pending === "google" ? copy.signingIn : copy.google}
      </Button>
      <FormStatus message={error} />
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.87h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.35Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.98-.9 6.63-2.42l-3.24-2.51c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.9A6.02 6.02 0 0 1 6.08 12c0-.66.11-1.3.31-1.9V7.51H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.49l3.35-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.97c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.51l3.35 2.59C7.18 7.73 9.39 5.97 12 5.97Z"
      />
    </svg>
  );
}

function AuthHeading({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}) {
  return (
    <div className="mb-6 text-center">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-6">
        {description}
      </p>
    </div>
  );
}

function FormStatus({ message }: { readonly message: string | null }) {
  return message ? (
    <p
      role="alert"
      className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm"
    >
      {message}
    </p>
  ) : null;
}

function SecurityNote({ children }: { readonly children: React.ReactNode }) {
  return (
    <p className="border-border text-muted-foreground mt-6 border-t pt-5 text-xs leading-5">
      {children}
    </p>
  );
}

function browserTimeZone(): string {
  if (typeof Intl === "undefined") return "UTC";
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function errorMessage(
  error: unknown,
  fallback: string,
  offline: string,
): string {
  if (typeof navigator !== "undefined" && !navigator.onLine) return offline;
  return error instanceof AuthApiError ? error.message : fallback;
}
