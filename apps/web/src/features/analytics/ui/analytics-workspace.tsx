"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle2,
  Download,
  FileChartColumn,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TimerReset,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import type { z } from "zod";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  AnalyticsExportView,
  AnalyticsSnapshot,
  GamificationView,
} from "@/features/analytics/domain/analytics-types";
import {
  analyticsExportResponseSchema,
  analyticsRangeSchema,
  analyticsResponseSchema,
  gamificationResponseSchema,
} from "@/features/analytics/transport/analytics-schemas";
import { AuthApiError, authFetch } from "@/features/auth/ui/auth-api";
import { useAuth } from "@/features/auth/ui/auth-provider";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

import { getAnalyticsCopy, type AnalyticsCopy } from "./analytics-copy";

type RangeForm = z.infer<typeof analyticsRangeSchema>;

export function AnalyticsWorkspace({ locale }: { readonly locale: Locale }) {
  const copy = getAnalyticsCopy(locale);
  const auth = useAuth();
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [gamification, setGamification] = useState<GamificationView | null>(
    null,
  );
  const [latestExport, setLatestExport] = useState<AnalyticsExportView | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<
    "report" | "csv" | "json" | "preference" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const form = useForm<RangeForm>({
    resolver: zodResolver(analyticsRangeSchema),
  });

  const load = useCallback(
    async (range?: RangeForm) => {
      if (auth.status !== "authenticated" || !auth.session) return;
      setLoading(true);
      setError(null);
      const query = range ? `?${new URLSearchParams(range)}` : "";
      try {
        const [analyticsRaw, gameRaw] = await Promise.all([
          authFetch<unknown>(
            `/api/v1/analytics${query}`,
            {},
            auth.session.accessToken,
          ),
          authFetch<unknown>(
            "/api/v1/gamification",
            {},
            auth.session.accessToken,
          ),
        ]);
        const analytics = analyticsResponseSchema.parse(analyticsRaw).data;
        const game = gamificationResponseSchema.parse(gameRaw).data;
        setSnapshot(analytics);
        setGamification(game);
        form.reset({ start: analytics.range.start, end: analytics.range.end });
      } catch (caught) {
        setError(message(caught, copy.errorTitle));
      } finally {
        setLoading(false);
      }
    },
    [auth.session, auth.status, form, copy.errorTitle],
  );

  useEffect(() => {
    const task = window.setTimeout(() => {
      if (auth.status === "authenticated") void load();
      if (auth.status === "anonymous") setLoading(false);
    }, 0);
    return () => window.clearTimeout(task);
  }, [auth.status, load]);

  async function createReport() {
    if (!snapshot || !auth.session) return;
    setAction("report");
    setNotice(null);
    try {
      await authFetch(
        "/api/v1/reports",
        {
          method: "POST",
          body: JSON.stringify({
            range: { start: snapshot.range.start, end: snapshot.range.end },
            clientCommandId: crypto.randomUUID(),
          }),
        },
        auth.session.accessToken,
      );
      setNotice(copy.reportSaved);
    } catch (caught) {
      setError(message(caught, copy.errorTitle));
    } finally {
      setAction(null);
    }
  }

  async function createExport(format: "csv" | "json") {
    if (!snapshot || !auth.session) return;
    setAction(format);
    setNotice(null);
    try {
      const raw = await authFetch<unknown>(
        "/api/v1/exports",
        {
          method: "POST",
          body: JSON.stringify({
            range: { start: snapshot.range.start, end: snapshot.range.end },
            format,
            clientCommandId: crypto.randomUUID(),
          }),
        },
        auth.session.accessToken,
      );
      setLatestExport(analyticsExportResponseSchema.parse(raw).data);
      setNotice(copy.exportReady);
    } catch (caught) {
      setError(message(caught, copy.errorTitle));
    } finally {
      setAction(null);
    }
  }

  async function downloadExport(item: AnalyticsExportView) {
    if (!auth.session) return;
    try {
      const response = await fetch(`/api/v1/exports/${item.id}/download`, {
        headers: { authorization: `Bearer ${auth.session.accessToken}` },
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error(copy.errorTitle);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = item.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(message(caught, copy.errorTitle));
    }
  }

  async function updateGamification(enabled: boolean) {
    if (!auth.session || !gamification) return;
    setAction("preference");
    try {
      const raw = await authFetch<unknown>(
        "/api/v1/gamification",
        {
          method: "PATCH",
          body: JSON.stringify({
            enabled,
            expectedVersion: gamification.version,
          }),
        },
        auth.session.accessToken,
      );
      setGamification(gamificationResponseSchema.parse(raw).data);
    } catch (caught) {
      setError(message(caught, copy.errorTitle));
    } finally {
      setAction(null);
    }
  }

  if (auth.status === "loading" || (loading && !snapshot))
    return <AnalyticsSkeleton copy={copy} />;
  if (auth.status === "anonymous") {
    return (
      <CenteredState title={copy.signInTitle}>
        <Link className={buttonVariants()} href={`/${locale}/sign-in` as Route}>
          {copy.signIn}
        </Link>
      </CenteredState>
    );
  }
  if (!snapshot) {
    return (
      <CenteredState
        title={copy.errorTitle}
        {...(error ? { description: error } : {})}
      >
        <Button onClick={() => void load()}>{copy.retry}</Button>
      </CenteredState>
    );
  }

  const hasActivity =
    snapshot.summary.completedSessions > 0 ||
    snapshot.summary.habitEligible > 0 ||
    snapshot.summary.goalCheckIns > 0;
  return (
    <main className="mx-auto max-w-[100rem] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
      <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-[var(--primary-text)]">
            {copy.eyebrow}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
            {copy.title}
          </h1>
          <p className="text-muted-foreground mt-2 leading-7">
            {copy.subtitle}
          </p>
        </div>
        <form
          className="bg-card/75 grid gap-3 rounded-2xl border p-3 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={form.handleSubmit((values) => void load(values))}
        >
          <DateField
            label={copy.start}
            error={form.formState.errors.start?.message}
            registration={form.register("start")}
          />
          <DateField
            label={copy.end}
            error={form.formState.errors.end?.message}
            registration={form.register("end")}
          />
          <Button className="self-end" type="submit" disabled={loading}>
            <RefreshCw
              className={cn(
                loading && "animate-spin motion-reduce:animate-none",
              )}
              aria-hidden="true"
            />
            {loading ? copy.applying : copy.apply}
          </Button>
        </form>
      </header>

      <div className="space-y-3" aria-live="polite">
        {snapshot.freshness === "partial" && (
          <Status tone="warning">{copy.partial}</Status>
        )}
        {snapshot.limitations.includes(
          "historic_goal_check_in_timezone_fallback",
        ) && <Status tone="warning">{copy.timezoneFallback}</Status>}
        {error && <Status tone="warning">{error}</Status>}
        {notice && <Status tone="success">{notice}</Status>}
      </div>

      {!hasActivity ? (
        <Card className="mt-6 border-dashed py-10 text-center">
          <CardContent>
            <BarChart3
              className="text-muted-foreground mx-auto size-10"
              aria-hidden="true"
            />
            <h2 className="mt-4 text-xl font-semibold">{copy.emptyTitle}</h2>
            <p className="text-muted-foreground mx-auto mt-2 max-w-xl">
              {copy.emptyBody}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Kpis snapshot={snapshot} copy={copy} locale={locale} />
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <TrendCard snapshot={snapshot} copy={copy} locale={locale} />
            <DistractionCard snapshot={snapshot} copy={copy} />
          </div>
        </>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileChartColumn aria-hidden="true" />
              {copy.reportsTitle}
            </CardTitle>
            <CardDescription>{copy.reportsDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => void createReport()}
                disabled={action !== null}
              >
                {action === "report" ? copy.savingReport : copy.saveReport}
              </Button>
              <Button
                variant="outline"
                onClick={() => void createExport("csv")}
                disabled={action !== null}
              >
                {action === "csv" ? copy.creatingExport : copy.exportCsv}
              </Button>
              <Button
                variant="outline"
                onClick={() => void createExport("json")}
                disabled={action !== null}
              >
                {action === "json" ? copy.creatingExport : copy.exportJson}
              </Button>
            </div>
            {latestExport && (
              <div className="bg-muted/45 flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {latestExport.fileName}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {copy.expires}:{" "}
                    {formatDateTime(
                      latestExport.expiresAt,
                      locale,
                      snapshot.timeZone,
                    )}
                  </p>
                </div>
                <Button
                  size="compact"
                  onClick={() => void downloadExport(latestExport)}
                >
                  <Download aria-hidden="true" />
                  {copy.download}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles aria-hidden="true" />
              {copy.gamificationTitle}
            </CardTitle>
            <CardDescription>{copy.gamificationDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {gamification && (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">
                    {copy.level(gamification.level, gamification.levelTitle)}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {copy.xp(gamification.totalXp)}
                  </p>
                </div>
                <label className="flex min-h-11 items-center gap-3 rounded-xl border px-4 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={gamification.enabled}
                    disabled={action !== null}
                    onChange={(event) =>
                      void updateGamification(event.target.checked)
                    }
                    className="accent-primary size-4"
                  />
                  {copy.enabled}
                </label>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="bg-muted/25 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck aria-hidden="true" />
              {copy.privacyTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm leading-7">
              {copy.privacyBody}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-muted/25 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain aria-hidden="true" />
              {copy.metricDefinitions}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <details>
              <summary className="cursor-pointer text-sm font-semibold">
                {copy.metricDefinitions}
              </summary>
              <ul className="mt-4 space-y-3">
                {snapshot.definitions.map((item) => (
                  <li
                    key={item.key}
                    className="text-muted-foreground text-sm leading-6"
                  >
                    <strong className="text-foreground">
                      {item.key} v{item.version}:
                    </strong>{" "}
                    {copy.definitionLabels[item.key] ?? item.definition}
                  </li>
                ))}
              </ul>
            </details>
            <p className="text-muted-foreground mt-4 text-xs">
              {copy.asOf(
                formatDateTime(snapshot.computedAt, locale, snapshot.timeZone),
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Kpis({
  snapshot,
  copy,
  locale,
}: {
  readonly snapshot: AnalyticsSnapshot;
  readonly copy: AnalyticsCopy;
  readonly locale: Locale;
}) {
  const items = [
    [
      copy.focusedTime,
      duration(snapshot.summary.focusedSeconds, locale),
      TimerReset,
    ],
    [
      copy.completedSessions,
      number(snapshot.summary.completedSessions, locale),
      CheckCircle2,
    ],
    [
      copy.planAttainment,
      percent(snapshot.summary.planAttainmentPercent, locale, copy),
      BarChart3,
    ],
    [
      copy.habitCompletion,
      percent(snapshot.summary.habitCompletionPercent, locale, copy),
      Sparkles,
    ],
    [
      copy.activeDays,
      number(snapshot.summary.activeFocusDays, locale),
      FileChartColumn,
    ],
    [copy.goalCheckIns, number(snapshot.summary.goalCheckIns, locale), Brain],
  ] as const;
  return (
    <section
      className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6"
      aria-label={copy.title}
    >
      {items.map(([label, value, Icon]) => (
        <Card key={label} className="overflow-hidden">
          <CardContent className="pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-muted-foreground text-xs font-semibold">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
              </div>
              <span className="bg-primary/10 grid size-9 place-items-center rounded-xl text-[var(--primary-text)]">
                <Icon className="size-4" aria-hidden="true" />
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function TrendCard({
  snapshot,
  copy,
  locale,
}: {
  readonly snapshot: AnalyticsSnapshot;
  readonly copy: AnalyticsCopy;
  readonly locale: Locale;
}) {
  const maximum = Math.max(
    1,
    ...snapshot.daily.map((day) => day.focusedSeconds),
  );
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle>{copy.trendTitle}</CardTitle>
        <CardDescription>{copy.trendDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="flex h-48 items-end gap-1 overflow-hidden"
          aria-hidden="true"
        >
          {snapshot.daily.map((day) => (
            <div
              key={day.localDate}
              className="bg-primary/20 hover:bg-primary/35 relative min-w-1 flex-1 rounded-t-sm transition-colors"
            >
              <div
                className="bg-primary absolute inset-x-0 bottom-0 rounded-t-sm"
                style={{
                  height: `${Math.max(day.focusedSeconds > 0 ? 4 : 0, (day.focusedSeconds / maximum) * 100)}%`,
                }}
              />
            </div>
          ))}
        </div>
        <details className="mt-5 max-w-full min-w-0">
          <summary className="cursor-pointer text-sm font-semibold">
            {copy.tableView}
          </summary>
          <div
            className="mt-3 w-full max-w-full overflow-x-auto"
            role="region"
            aria-label={copy.tableView}
            tabIndex={0}
          >
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-muted-foreground border-b">
                <tr>
                  <th className="py-2">{copy.date}</th>
                  <th>{copy.focusMinutes}</th>
                  <th>{copy.sessions}</th>
                  <th>{copy.interruptions}</th>
                  <th>{copy.habits}</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.daily.map((day) => (
                  <tr key={day.localDate} className="border-b last:border-0">
                    <td className="py-2">
                      {formatDate(day.localDate, locale, snapshot.timeZone)}
                    </td>
                    <td>
                      {number(Math.round(day.focusedSeconds / 60), locale)}
                    </td>
                    <td>{number(day.completedSessions, locale)}</td>
                    <td>{number(day.interruptionCount, locale)}</td>
                    <td>{number(day.habitCompleted, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function DistractionCard({
  snapshot,
  copy,
}: {
  readonly snapshot: AnalyticsSnapshot;
  readonly copy: AnalyticsCopy;
}) {
  const categories = Object.entries(snapshot.interruptions.byCategory).sort(
    (a, b) => b[1] - a[1],
  );
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle>{copy.distractionTitle}</CardTitle>
        <CardDescription>{copy.distractionDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-semibold">
          {copy.sampleSize(snapshot.interruptions.sampleSize)}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {copy.notCausation}
        </p>
        {categories.length === 0 ? (
          <p className="text-muted-foreground mt-6 text-sm">
            {copy.noInterruptions}
          </p>
        ) : (
          <table className="mt-5 w-full text-left text-sm">
            <thead className="text-muted-foreground border-b">
              <tr>
                <th className="py-2">{copy.category}</th>
                <th className="text-right">{copy.count}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(([key, value]) => (
                <tr key={key} className="border-b last:border-0">
                  <td className="py-3">{copy.categoryLabels[key] ?? key}</td>
                  <td className="text-right font-semibold tabular-nums">
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function DateField({
  label,
  error,
  registration,
}: {
  readonly label: string;
  readonly error: string | undefined;
  readonly registration: UseFormRegisterReturn;
}) {
  return (
    <label className="block text-xs font-semibold">
      {label}
      <Input
        type="date"
        className="mt-1 h-10 min-w-36 text-sm"
        aria-invalid={Boolean(error)}
        {...registration}
      />
      {error && (
        <span className="text-destructive mt-1 block text-xs">{error}</span>
      )}
    </label>
  );
}

function Status({
  tone,
  children,
}: {
  readonly tone: "warning" | "success";
  readonly children: React.ReactNode;
}) {
  const Icon = tone === "warning" ? AlertTriangle : CheckCircle2;
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm",
        tone === "warning"
          ? "border-amber-500/30 bg-amber-500/10"
          : "border-emerald-500/30 bg-emerald-500/10",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

function CenteredState({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-[70svh] place-items-center px-4">
      <div className="max-w-lg text-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-2">{description}</p>
        )}
        <div className="mt-5">{children}</div>
      </div>
    </main>
  );
}

function AnalyticsSkeleton({ copy }: { readonly copy: AnalyticsCopy }) {
  return (
    <main
      className="mx-auto max-w-[100rem] animate-pulse px-4 py-8 motion-reduce:animate-none"
      aria-busy="true"
    >
      <span className="sr-only">{copy.loading}</span>
      <div className="bg-muted h-10 w-64 rounded-xl" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="bg-muted h-28 rounded-2xl" />
        ))}
      </div>
      <div className="bg-muted mt-6 h-80 rounded-2xl" />
    </main>
  );
}

function duration(seconds: number, locale: Locale) {
  const hours = seconds / 3600;
  return locale === "bn-BD"
    ? `${new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 1 }).format(hours)} ঘণ্টা`
    : `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(hours)} hr`;
}
function number(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale).format(value);
}
function percent(value: number | null, locale: Locale, copy: AnalyticsCopy) {
  return value === null
    ? copy.noDenominator
    : new Intl.NumberFormat(locale, {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(value / 100);
}
function formatDate(value: string, locale: Locale, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone,
  }).format(new Date(`${value}T12:00:00.000Z`));
}
function formatDateTime(value: string, locale: Locale, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}
function message(error: unknown, fallback: string) {
  return error instanceof AuthApiError || error instanceof Error
    ? error.message
    : fallback;
}
