"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  forgotPasswordRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
} from "@/features/auth/transport/auth-schemas";
import type { OAuthProvider } from "@/features/auth/domain/oauth-types";
import type { Locale } from "@/i18n/config";

import { AuthApiError, authFetch } from "./auth-api";
import { getAuthCopy } from "./auth-copy";
import { useAuth } from "./auth-provider";

type LoginValues = z.infer<typeof loginRequestSchema>;
type RegisterValues = z.infer<typeof registerRequestSchema>;
type ForgotValues = z.infer<typeof forgotPasswordRequestSchema>;

const subscribeToStaticHash = () => () => undefined;

function readHashToken(): string {
  return new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
}

function useHashToken(): string {
  return useSyncExternalStore(subscribeToStaticHash, readHashToken, () => "");
}

export function SignInForm({ locale }: { readonly locale: Locale }) {
  const copy = getAuthCopy(locale);
  const router = useRouter();
  const auth = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: "", password: "" },
  });

  async function submit(values: LoginValues) {
    setFormError(null);
    try {
      await auth.signIn(values.email, values.password);
      router.replace(`/${locale}/dashboard` as Route);
    } catch (error) {
      setFormError(errorMessage(error, copy.unexpected, copy.offline));
    }
  }

  return (
    <>
      <AuthHeading
        title={copy.signInTitle}
        description={copy.signInDescription}
      />
      <OAuthButtons locale={locale} />
      <Divider label={copy.or} />
      <form
        onSubmit={form.handleSubmit(submit)}
        className="space-y-4"
        noValidate
      >
        <FormField
          label={copy.email}
          error={form.formState.errors.email?.message}
        >
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            {...form.register("email")}
          />
        </FormField>
        <FormField
          label={copy.password}
          error={form.formState.errors.password?.message}
        >
          <Input
            aria-label={copy.password}
            type="password"
            autoComplete="current-password"
            {...form.register("password")}
          />
        </FormField>
        <div className="flex justify-end">
          <Link
            className="text-primary text-sm font-semibold hover:underline"
            href={`/${locale}/forgot-password`}
          >
            {copy.forgotPassword}
          </Link>
        </div>
        <FormStatus message={formError} />
        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? copy.signingIn : copy.signIn}
        </Button>
      </form>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        {copy.noAccount}{" "}
        <Link
          className="text-primary font-semibold hover:underline"
          href={`/${locale}/sign-up`}
        >
          {copy.signUp}
        </Link>
      </p>
      <SecurityNote>{copy.securityNote}</SecurityNote>
    </>
  );
}

export function SignUpForm({ locale }: { readonly locale: Locale }) {
  const copy = getAuthCopy(locale);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: {
      email: "",
      password: "",
      displayName: "",
      locale,
      timeZone: browserTimeZone(),
    },
  });

  async function submit(values: RegisterValues) {
    setFormError(null);
    setMessage(null);
    try {
      await authFetch("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setMessage(copy.genericRegistration);
      form.reset({ ...values, password: "" });
    } catch (error) {
      applyFieldErrors(error, form.setError);
      setFormError(errorMessage(error, copy.unexpected, copy.offline));
    }
  }

  return (
    <>
      <AuthHeading
        title={copy.signUpTitle}
        description={copy.signUpDescription}
      />
      <OAuthButtons locale={locale} />
      <Divider label={copy.or} />
      <form
        onSubmit={form.handleSubmit(submit)}
        className="space-y-4"
        noValidate
      >
        <FormField
          label={copy.displayName}
          error={form.formState.errors.displayName?.message}
        >
          <Input autoComplete="name" {...form.register("displayName")} />
        </FormField>
        <FormField
          label={copy.email}
          error={form.formState.errors.email?.message}
        >
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            {...form.register("email")}
          />
        </FormField>
        <FormField
          label={copy.password}
          error={form.formState.errors.password?.message}
        >
          <Input
            aria-label={copy.password}
            type="password"
            autoComplete="new-password"
            aria-describedby="password-guidance"
            {...form.register("password")}
          />
          <span
            id="password-guidance"
            className="text-muted-foreground mt-1 block text-xs"
          >
            {copy.resetDescription}
          </span>
        </FormField>
        <FormStatus message={formError} />
        {message ? (
          <p
            role="status"
            className="bg-success/10 text-success rounded-xl p-3 text-sm"
          >
            {message}
          </p>
        ) : null}
        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? copy.creating : copy.signUp}
        </Button>
      </form>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        {copy.haveAccount}{" "}
        <Link
          className="text-primary font-semibold hover:underline"
          href={`/${locale}/sign-in`}
        >
          {copy.signIn}
        </Link>
      </p>
    </>
  );
}

export function ForgotPasswordForm({ locale }: { readonly locale: Locale }) {
  const copy = getAuthCopy(locale);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: "", locale },
  });

  async function submit(values: ForgotValues) {
    setFormError(null);
    try {
      await authFetch("/api/v1/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setMessage(copy.genericRecovery);
    } catch (error) {
      setFormError(errorMessage(error, copy.unexpected, copy.offline));
    }
  }

  return (
    <>
      <AuthHeading
        title={copy.recoveryTitle}
        description={copy.recoveryDescription}
      />
      <form
        onSubmit={form.handleSubmit(submit)}
        className="space-y-4"
        noValidate
      >
        <FormField
          label={copy.email}
          error={form.formState.errors.email?.message}
        >
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            {...form.register("email")}
          />
        </FormField>
        <FormStatus message={formError} />
        {message ? (
          <p
            role="status"
            className="bg-success/10 text-success rounded-xl p-3 text-sm"
          >
            {message}
          </p>
        ) : null}
        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? copy.sending : copy.sendRecovery}
        </Button>
      </form>
    </>
  );
}

export function ResetPasswordForm({ locale }: { readonly locale: Locale }) {
  const copy = getAuthCopy(locale);
  const router = useRouter();
  const token = useHashToken();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<{ password: string }>({
    defaultValues: { password: "" },
  });

  useEffect(() => {
    if (token) history.replaceState(null, "", window.location.pathname);
  }, [token]);

  async function submit(values: { password: string }) {
    setFormError(null);
    const parsed = resetPasswordRequestSchema.safeParse({
      token,
      password: values.password,
    });
    if (!parsed.success) {
      setFormError(copy.unexpected);
      return;
    }
    try {
      await authFetch("/api/v1/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      router.replace(`/${locale}/sign-in`);
    } catch (error) {
      setFormError(errorMessage(error, copy.unexpected, copy.offline));
    }
  }

  return (
    <>
      <AuthHeading
        title={copy.resetTitle}
        description={copy.resetDescription}
      />
      <form
        onSubmit={form.handleSubmit(submit)}
        className="space-y-4"
        noValidate
      >
        <FormField label={copy.newPassword}>
          <Input
            aria-label={copy.newPassword}
            type="password"
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            {...form.register("password", { required: true })}
          />
        </FormField>
        <FormStatus message={formError} />
        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting || !token}
        >
          {form.formState.isSubmitting ? copy.resetting : copy.resetPassword}
        </Button>
      </form>
    </>
  );
}

export function VerifyEmailAction({ locale }: { readonly locale: Locale }) {
  const copy = getAuthCopy(locale);
  const token = useHashToken();
  const [state, setState] = useState<{
    kind: "loading" | "success" | "error";
    message: string;
  }>({
    kind: "loading",
    message: copy.verifying,
  });

  useEffect(() => {
    if (!token) return;
    history.replaceState(null, "", window.location.pathname);
    void authFetch("/api/v1/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(() => setState({ kind: "success", message: copy.verified }))
      .catch((error: unknown) =>
        setState({
          kind: "error",
          message: errorMessage(error, copy.unexpected, copy.offline),
        }),
      );
  }, [copy, token]);

  return (
    <>
      <AuthHeading
        title={copy.verifyTitle}
        description={copy.verifyDescription}
      />
      <p
        role="status"
        aria-live="polite"
        className="bg-muted rounded-xl p-4 text-sm"
      >
        {token ? state.message : copy.unexpected}
      </p>
      {state.kind === "success" ? (
        <Link
          className="bg-primary text-primary-foreground mt-5 flex h-11 items-center justify-center rounded-xl px-5 font-semibold"
          href={`/${locale}/sign-in`}
        >
          {copy.signIn}
        </Link>
      ) : null}
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

function OAuthButtons({ locale }: { readonly locale: Locale }) {
  const copy = getAuthCopy(locale);
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function start(provider: OAuthProvider) {
    setPending(provider);
    setError(null);
    try {
      const result = await authFetch<{ authorizationUrl: string }>(
        `/api/v1/auth/oauth/${provider}/start`,
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
    <div className="space-y-2">
      {(["google", "github", "microsoft"] as const).map((provider) => (
        <Button
          key={provider}
          variant="outline"
          className="w-full"
          disabled={pending !== null}
          onClick={() => void start(provider)}
        >
          {pending === provider ? copy.signingIn : copy[provider]}
        </Button>
      ))}
      <FormStatus message={error} />
    </div>
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

function FormField({
  label,
  error,
  children,
}: {
  readonly label: string;
  readonly error?: string | undefined;
  readonly children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="text-destructive block text-sm">
          {error}
        </span>
      ) : null}
    </label>
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

function Divider({ label }: { readonly label: string }) {
  return (
    <div
      className="text-muted-foreground my-5 flex items-center gap-3 text-xs"
      aria-hidden="true"
    >
      <span className="bg-border h-px flex-1" />
      <span>{label}</span>
      <span className="bg-border h-px flex-1" />
    </div>
  );
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

function applyFieldErrors<TValues extends Record<string, unknown>>(
  error: unknown,
  setError: ReturnType<typeof useForm<TValues>>["setError"],
): void {
  if (!(error instanceof AuthApiError)) return;
  for (const [field, message] of Object.entries(error.fieldErrors)) {
    setError(field as never, { type: "server", message });
  }
}
