"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BrainCircuit,
  CheckCircle2,
  Circle,
  Clock3,
  CloudOff,
  Goal,
  ListChecks,
  RefreshCw,
  Settings2,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  DashboardSnapshot,
  DashboardWidgetKey,
} from "@/features/dashboard/domain/dashboard-types";
import {
  dashboardResponseSchema,
  dashboardSnapshotSchema,
  dashboardWidgetResponseSchema,
  updateDashboardWidgetsSchema,
} from "@/features/dashboard/transport/dashboard-schemas";
import { AuthApiError, authFetch } from "@/features/auth/ui/auth-api";
import { useAuth } from "@/features/auth/ui/auth-provider";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

import { getDashboardCopy, type DashboardCopy } from "./dashboard-copy";

type WidgetForm = z.infer<typeof updateDashboardWidgetsSchema>;

interface DashboardProps {
  readonly locale: Locale;
}

export function Dashboard({ locale }: DashboardProps) {
  const copy = getDashboardCopy(locale);
  const auth = useAuth();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (auth.status !== "authenticated" || !auth.session) return;
    setLoading(true);
    setError(null);
    const cacheKey = dashboardCacheKey(auth.session.user.id);
    try {
      const unsafeResponse = await authFetch<unknown>(
        "/api/v1/dashboard",
        {},
        auth.session.accessToken,
      );
      const response = dashboardResponseSchema.parse(unsafeResponse);
      setSnapshot(response.data);
      setOffline(false);
      sessionStorage.setItem(cacheKey, JSON.stringify(response.data));
    } catch (caught) {
      const cached = readCachedSnapshot(cacheKey);
      if (cached) {
        setSnapshot({ ...cached, freshness: "stale" });
        setOffline(true);
      } else {
        setError(dashboardError(caught, copy));
      }
    } finally {
      setLoading(false);
    }
  }, [auth.session, auth.status, copy]);

  useEffect(() => {
    const task = window.setTimeout(() => {
      if (auth.status === "authenticated") void load();
      if (auth.status === "anonymous") setLoading(false);
    }, 0);
    return () => window.clearTimeout(task);
  }, [auth.status, load]);

  if (auth.status === "loading" || (loading && !snapshot)) {
    return <DashboardSkeleton copy={copy} />;
  }
  if (auth.status === "anonymous") {
    return <SignInState locale={locale} copy={copy} />;
  }
  if (!snapshot) {
    return <DashboardFailure copy={copy} message={error} retry={load} />;
  }

  return (
    <DashboardContent
      locale={locale}
      copy={copy}
      snapshot={snapshot}
      setSnapshot={setSnapshot}
      accessToken={auth.session!.accessToken}
      offline={offline}
      refreshing={loading}
      refresh={load}
    />
  );
}

interface DashboardContentProps {
  readonly locale: Locale;
  readonly copy: DashboardCopy;
  readonly snapshot: DashboardSnapshot;
  readonly setSnapshot: React.Dispatch<
    React.SetStateAction<DashboardSnapshot | null>
  >;
  readonly accessToken: string;
  readonly offline: boolean;
  readonly refreshing: boolean;
  readonly refresh: () => Promise<void>;
}

function DashboardContent({
  locale,
  copy,
  snapshot,
  setSnapshot,
  accessToken,
  offline,
  refreshing,
  refresh,
}: DashboardContentProps) {
  const visibleWidgets = snapshot.layout.widgets.filter(
    (widget) => widget.visible,
  );
  const hasPartialFailure = snapshot.degradations.some(
    (item) => item.code === "source_unavailable",
  );

  return (
    <div className="mx-auto max-w-[100rem] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--primary-text)]">
            Dashboard
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
            {copy.greeting(snapshot.data.displayName)}
          </h1>
          <p className="text-muted-foreground mt-2 text-base">
            {copy.subtitle}
          </p>
        </div>
        <Button
          variant="ghost"
          size="compact"
          onClick={() => void refresh()}
          disabled={refreshing}
          aria-label={copy.retry}
        >
          <RefreshCw
            className={cn(
              refreshing && "animate-spin motion-reduce:animate-none",
            )}
          />
          {copy.retry}
        </Button>
      </header>

      <StatusMessages
        copy={copy}
        offline={offline}
        stale={snapshot.freshness === "stale"}
        partial={hasPartialFailure}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-12">
          {visibleWidgets.map((widget) => (
            <Widget
              key={widget.key}
              widgetKey={widget.key}
              snapshot={snapshot}
              copy={copy}
              locale={locale}
            />
          ))}
          <GuidedStart copy={copy} />
        </div>

        <aside className="space-y-5" aria-label={copy.contextTitle}>
          <WidgetPreferences
            copy={copy}
            snapshot={snapshot}
            accessToken={accessToken}
            setSnapshot={setSnapshot}
            disabled={offline}
          />
          <Card className="bg-muted/35 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">{copy.contextTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm leading-7">
                {copy.contextPrivacy}
              </p>
              <p className="text-muted-foreground mt-4 text-xs">
                {copy.asOf(
                  formatDateTime(
                    snapshot.computedAt,
                    locale,
                    snapshot.timeZone,
                  ),
                )}
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Widget({
  widgetKey,
  snapshot,
  copy,
  locale,
}: {
  readonly widgetKey: DashboardWidgetKey;
  readonly snapshot: DashboardSnapshot;
  readonly copy: DashboardCopy;
  readonly locale: Locale;
}) {
  if (widgetKey === "today_focus") {
    const focus = snapshot.data.todayFocus;
    return (
      <Card className="focused-glass-strong relative overflow-hidden md:col-span-2 xl:col-span-8">
        <div
          className="bg-primary/12 pointer-events-none absolute -top-24 -right-16 size-56 rounded-full blur-3xl"
          aria-hidden="true"
        />
        <CardHeader className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">{copy.focusTitle}</CardTitle>
              <CardDescription>{copy.focusDescription}</CardDescription>
            </div>
            <span className="bg-primary/10 grid size-11 shrink-0 place-items-center rounded-xl text-[var(--primary-text)]">
              <Target aria-hidden="true" />
            </span>
          </div>
        </CardHeader>
        <CardContent className="relative">
          {focus.state === "unavailable" ? (
            <Unavailable copy={copy} />
          ) : focus.priorities.length === 0 ? (
            <p className="text-muted-foreground max-w-2xl text-sm leading-7">
              {copy.noPriorities}
            </p>
          ) : (
            <>
              <ul className="space-y-3" aria-label={copy.focusTitle}>
                {focus.priorities.map((priority) => (
                  <li
                    key={priority.id}
                    className="border-border bg-card/75 flex items-start gap-3 rounded-xl border p-3"
                  >
                    {priority.status === "completed" ? (
                      <CheckCircle2
                        className="text-success mt-0.5 size-5 shrink-0"
                        aria-hidden="true"
                      />
                    ) : (
                      <Circle
                        className="text-muted-foreground mt-0.5 size-5 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={cn(
                        "font-medium",
                        priority.status === "completed" &&
                          "text-muted-foreground line-through",
                      )}
                    >
                      {priority.title}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground mt-4 text-sm">
                {copy.prioritiesProgress(
                  focus.completedCount,
                  focus.totalCount,
                )}
              </p>
            </>
          )}
          <Link
            href="#guided-start"
            className={cn(buttonVariants({ variant: "primary" }), "mt-6")}
          >
            <Sparkles aria-hidden="true" />
            {copy.primaryAction}
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (widgetKey === "active_session") {
    const focus = snapshot.data.focusSession;
    return (
      <SummaryCard
        id="focus-session"
        className="xl:col-span-4"
        title={copy.activeSessionTitle}
        icon={Clock3}
      >
        {focus.state === "unavailable" ? (
          <Unavailable copy={copy} />
        ) : focus.session ? (
          <div>
            <p className="text-lg font-semibold">{focus.session.intent}</p>
            <p className="text-muted-foreground mt-2 text-sm">
              {focus.session.status === "running"
                ? copy.activeSession
                : copy.pausedSession}{" "}
              · {formatDuration(focus.session.plannedSeconds, locale)}
            </p>
          </div>
        ) : (
          <EmptyText>{copy.noSession}</EmptyText>
        )}
      </SummaryCard>
    );
  }

  if (widgetKey === "weekly_progress") {
    const weekly = snapshot.data.weeklyProgress;
    const percentage =
      weekly.totalPriorities > 0
        ? Math.round(
            (weekly.completedPriorities / weekly.totalPriorities) * 100,
          )
        : 0;
    return (
      <SummaryCard
        className="xl:col-span-6"
        title={copy.weeklyTitle}
        icon={ListChecks}
      >
        {weekly.state === "unavailable" ? (
          <Unavailable copy={copy} />
        ) : weekly.state === "empty" ? (
          <EmptyText>{copy.weeklyEmpty}</EmptyText>
        ) : (
          <>
            <div className="flex items-end justify-between gap-4">
              <p className="text-3xl font-bold tabular-nums">
                {formatNumber(percentage, locale)}%
              </p>
              <p className="text-muted-foreground text-sm">
                {copy.focusedTime}:{" "}
                {formatDuration(weekly.focusedSeconds, locale)}
              </p>
            </div>
            <Progress value={percentage} label={copy.weeklyTitle} />
          </>
        )}
      </SummaryCard>
    );
  }

  if (widgetKey === "habits") {
    const habits = snapshot.data.habits;
    return (
      <SummaryCard
        className="xl:col-span-6"
        title={copy.habitsTitle}
        icon={CheckCircle2}
      >
        {habits.state === "unavailable" ? (
          <Unavailable copy={copy} />
        ) : habits.state === "not_configured" ? (
          <EmptyText>{copy.habitsNotConfigured}</EmptyText>
        ) : (
          <>
            <p className="text-lg font-semibold">
              {copy.habitsProgress(habits.completedCount, habits.dueCount)}
            </p>
            <Progress
              value={
                habits.dueCount
                  ? (habits.completedCount / habits.dueCount) * 100
                  : 0
              }
              label={copy.habitsTitle}
            />
          </>
        )}
      </SummaryCard>
    );
  }

  if (widgetKey === "goals") {
    const goals = snapshot.data.goals;
    return (
      <SummaryCard
        className="xl:col-span-4"
        title={copy.goalsTitle}
        icon={Goal}
      >
        {goals.state === "unavailable" ? (
          <Unavailable copy={copy} />
        ) : goals.state === "not_configured" ? (
          <EmptyText>{copy.goalsNotConfigured}</EmptyText>
        ) : (
          <div>
            <p className="text-lg font-semibold">
              {copy.goalsActive(goals.activeCount)}
            </p>
            {goals.nextGoal && (
              <p className="text-muted-foreground mt-2 text-sm">
                {goals.nextGoal.title}
              </p>
            )}
          </div>
        )}
      </SummaryCard>
    );
  }

  if (widgetKey === "reminders") {
    const reminders = snapshot.data.reminders;
    return (
      <SummaryCard
        className="xl:col-span-4"
        title={copy.remindersTitle}
        icon={Clock3}
      >
        {reminders.state === "unavailable" ? (
          <Unavailable copy={copy} />
        ) : reminders.state === "not_configured" ? (
          <EmptyText>{copy.remindersNotConfigured}</EmptyText>
        ) : reminders.dueCount === 0 ? (
          <EmptyText>{copy.remindersEmpty}</EmptyText>
        ) : (
          <div>
            <p className="text-lg font-semibold">
              {copy.remindersDue(reminders.dueCount)}
            </p>
            {reminders.nextReminder && (
              <p className="text-muted-foreground mt-2 text-sm">
                {reminders.nextReminder.title} ·{" "}
                {formatDateTime(
                  reminders.nextReminder.scheduledFor,
                  locale,
                  snapshot.timeZone,
                )}
              </p>
            )}
          </div>
        )}
      </SummaryCard>
    );
  }

  return (
    <SummaryCard
      className="xl:col-span-4"
      title={copy.aiTitle}
      icon={BrainCircuit}
    >
      <EmptyText>{copy.aiComingSoon}</EmptyText>
    </SummaryCard>
  );
}

function SummaryCard({
  id,
  title,
  icon: Icon,
  className,
  children,
}: {
  readonly id?: string;
  readonly title: string;
  readonly icon: typeof Clock3;
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Card id={id} className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle>{title}</CardTitle>
        <span className="bg-secondary text-accent grid size-10 place-items-center rounded-xl">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function WidgetPreferences({
  copy,
  snapshot,
  accessToken,
  setSnapshot,
  disabled,
}: {
  readonly copy: DashboardCopy;
  readonly snapshot: DashboardSnapshot;
  readonly accessToken: string;
  readonly setSnapshot: React.Dispatch<
    React.SetStateAction<DashboardSnapshot | null>
  >;
  readonly disabled: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<WidgetForm>({
    resolver: zodResolver(updateDashboardWidgetsSchema),
    defaultValues: {
      expectedVersion: snapshot.layout.version,
      widgets: [...snapshot.layout.widgets],
    },
  });
  const widgets = useWatch({ control: form.control, name: "widgets" });

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 1 || target >= widgets.length) return;
    const next = [...widgets];
    [next[index], next[target]] = [next[target]!, next[index]!];
    form.setValue("widgets", next, { shouldDirty: true, shouldValidate: true });
  }

  async function submit(values: WidgetForm) {
    setMessage(null);
    const previous = snapshot.layout;
    const optimistic = {
      version: previous.version + 1,
      widgets: values.widgets,
    };
    setSnapshot((current) =>
      current ? { ...current, layout: optimistic } : current,
    );
    try {
      const unsafeResponse = await authFetch<unknown>(
        "/api/v1/dashboard/widgets",
        { method: "PATCH", body: JSON.stringify(values) },
        accessToken,
      );
      const response = dashboardWidgetResponseSchema.parse(unsafeResponse);
      setSnapshot((current) =>
        current ? { ...current, layout: response.data } : current,
      );
      form.reset({
        expectedVersion: response.data.version,
        widgets: [...response.data.widgets],
      });
      setMessage(copy.layoutSaved);
    } catch (error) {
      setSnapshot((current) =>
        current ? { ...current, layout: previous } : current,
      );
      form.reset({
        expectedVersion: previous.version,
        widgets: [...previous.widgets],
      });
      setMessage(dashboardError(error, copy));
    }
  }

  return (
    <Card>
      <details>
        <summary className="focus-visible:outline-primary flex min-h-14 cursor-pointer list-none items-center gap-3 px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2">
          <Settings2 className="size-5" aria-hidden="true" />
          {copy.customize}
        </summary>
        <form
          onSubmit={form.handleSubmit(submit)}
          className="border-border border-t p-5"
          noValidate
        >
          <p className="text-muted-foreground text-sm leading-6">
            {copy.customizeDescription}
          </p>
          <ul className="mt-4 space-y-2">
            {widgets.map((widget, index) => (
              <li
                key={widget.key}
                className="border-border flex items-center gap-2 rounded-xl border p-2"
              >
                <label className="flex min-h-10 min-w-0 flex-1 items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={widget.visible}
                    disabled={widget.key === "today_focus" || disabled}
                    onChange={(event) => {
                      const next = [...widgets];
                      next[index] = {
                        ...widget,
                        visible: event.target.checked,
                      };
                      form.setValue("widgets", next, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    className="accent-primary size-4"
                  />
                  <span className="truncate">
                    {copy.widgetLabels[widget.key]}
                  </span>
                  <span className="sr-only">
                    {widget.visible ? copy.hideWidget : copy.showWidget}
                  </span>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index <= 1 || disabled}
                  onClick={() => move(index, -1)}
                  aria-label={`${copy.moveUp}: ${copy.widgetLabels[widget.key]}`}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={
                    index === 0 || index === widgets.length - 1 || disabled
                  }
                  onClick={() => move(index, 1)}
                  aria-label={`${copy.moveDown}: ${copy.widgetLabels[widget.key]}`}
                >
                  <ArrowDown />
                </Button>
              </li>
            ))}
          </ul>
          {form.formState.errors.widgets && (
            <p role="alert" className="text-destructive mt-3 text-sm">
              {form.formState.errors.widgets.message}
            </p>
          )}
          {message && (
            <p role="status" className="text-muted-foreground mt-3 text-sm">
              {message}
            </p>
          )}
          <Button
            type="submit"
            className="mt-4 w-full"
            variant="outline"
            disabled={
              !form.formState.isDirty || form.formState.isSubmitting || disabled
            }
          >
            {form.formState.isSubmitting ? copy.savingLayout : copy.saveLayout}
          </Button>
        </form>
      </details>
    </Card>
  );
}

function GuidedStart({ copy }: { readonly copy: DashboardCopy }) {
  return (
    <Card id="guided-start" className="md:col-span-2 xl:col-span-12">
      <CardHeader>
        <CardTitle>{copy.guidedTitle}</CardTitle>
        <CardDescription>{copy.guidedDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-3 md:grid-cols-3">
          {copy.guidedSteps.map((step, index) => (
            <li key={step} className="bg-muted/50 flex gap-3 rounded-xl p-4">
              <span className="bg-primary text-primary-foreground grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold">
                {index + 1}
              </span>
              <span className="text-sm leading-6 font-medium">{step}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function StatusMessages({
  copy,
  offline,
  stale,
  partial,
}: {
  readonly copy: DashboardCopy;
  readonly offline: boolean;
  readonly stale: boolean;
  readonly partial: boolean;
}) {
  const messages = [
    offline ? { icon: CloudOff, text: copy.offline } : null,
    stale && !offline ? { icon: Clock3, text: copy.stale } : null,
    partial ? { icon: AlertTriangle, text: copy.partial } : null,
  ].filter((value): value is { icon: typeof CloudOff; text: string } =>
    Boolean(value),
  );
  if (messages.length === 0) return null;
  return (
    <div className="mb-6 space-y-2" role="status">
      {messages.map(({ icon: Icon, text }) => (
        <div
          key={text}
          className="border-warning/30 bg-warning/8 text-foreground flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
        >
          <Icon
            className="text-warning mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>{text}</span>
        </div>
      ))}
    </div>
  );
}

function Progress({
  value,
  label,
}: {
  readonly value: number;
  readonly label: string;
}) {
  const bounded = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className="bg-muted mt-4 h-2 overflow-hidden rounded-full"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={bounded}
    >
      <div
        className="focused-brand-gradient h-full rounded-full transition-[width] motion-reduce:transition-none"
        style={{ width: `${bounded}%` }}
      />
    </div>
  );
}

function Unavailable({ copy }: { readonly copy: DashboardCopy }) {
  return (
    <p className="text-muted-foreground flex items-start gap-2 text-sm leading-6">
      <AlertTriangle
        className="text-warning mt-0.5 size-4 shrink-0"
        aria-hidden="true"
      />
      {copy.unavailable}
    </p>
  );
}

function EmptyText({ children }: { readonly children: React.ReactNode }) {
  return <p className="text-muted-foreground text-sm leading-7">{children}</p>;
}

function SignInState({
  locale,
  copy,
}: {
  readonly locale: Locale;
  readonly copy: DashboardCopy;
}) {
  return (
    <div className="grid min-h-[70svh] place-items-center p-4">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <CardTitle className="text-2xl">{copy.signInTitle}</CardTitle>
          <CardDescription>{copy.signInDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href={`/${locale}/sign-in`}
            className={buttonVariants({ variant: "primary" })}
          >
            {copy.signInAction}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardFailure({
  copy,
  message,
  retry,
}: {
  readonly copy: DashboardCopy;
  readonly message: string | null;
  readonly retry: () => Promise<void>;
}) {
  return (
    <div className="grid min-h-[70svh] place-items-center p-4">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <span className="bg-destructive/10 text-destructive mx-auto grid size-12 place-items-center rounded-full">
            <AlertTriangle aria-hidden="true" />
          </span>
          <CardTitle>{copy.unavailable}</CardTitle>
          <CardDescription>{message ?? copy.stale}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void retry()}>
            <RefreshCw />
            {copy.retry}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardSkeleton({ copy }: { readonly copy: DashboardCopy }) {
  return (
    <div
      className="mx-auto max-w-[100rem] px-4 py-8 sm:px-6 xl:px-8"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">
        {copy.loading}. {copy.loadingDescription}
      </span>
      <div className="bg-muted h-4 w-24 animate-pulse rounded motion-reduce:animate-none" />
      <div className="bg-muted mt-3 h-10 w-72 max-w-full animate-pulse rounded-xl motion-reduce:animate-none" />
      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-12">
        <SkeletonCard className="h-80 md:col-span-2 xl:col-span-8" />
        <SkeletonCard className="h-80 xl:col-span-4" />
        <SkeletonCard className="h-52 xl:col-span-6" />
        <SkeletonCard className="h-52 xl:col-span-6" />
      </div>
    </div>
  );
}

function SkeletonCard({ className }: { readonly className: string }) {
  return (
    <div
      className={cn(
        "border-border bg-card animate-pulse rounded-2xl border motion-reduce:animate-none",
        className,
      )}
      aria-hidden="true"
    />
  );
}

function dashboardCacheKey(userId: string): string {
  return `focused.dashboard.v1.${userId}`;
}

function readCachedSnapshot(key: string): DashboardSnapshot | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null") as unknown;
    const result = dashboardSnapshotSchema.safeParse(value);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function dashboardError(error: unknown, copy: DashboardCopy): string {
  if (error instanceof AuthApiError) return error.message;
  if (error instanceof TypeError) return copy.offline;
  return copy.unavailable;
}

function formatDateTime(
  value: string,
  locale: Locale,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(seconds: number, locale: Locale): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const formatter = new Intl.NumberFormat(locale);
  if (hours > 0)
    return `${formatter.format(hours)}h ${formatter.format(minutes)}m`;
  return `${formatter.format(minutes)}m`;
}

function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale).format(value);
}
