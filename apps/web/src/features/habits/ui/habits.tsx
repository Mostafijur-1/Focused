"use client";

import {
  Archive,
  Check,
  ChevronDown,
  CloudOff,
  History,
  Pause,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AuthApiError, authFetch } from "@/features/auth/ui/auth-api";
import { useAuth } from "@/features/auth/ui/auth-provider";
import type {
  HabitHistoryPage,
  HabitListView,
  HabitSummary,
} from "@/features/habits/domain/habit-types";
import {
  habitHistoryResponseSchema,
  habitListResponseSchema,
  habitResponseSchema,
} from "@/features/habits/transport/habit-schemas";
import { getHabitCopy, type HabitCopy } from "@/features/habits/ui/habit-copy";
import {
  HabitForm,
  type HabitFormPayload,
} from "@/features/habits/ui/habit-form";
import {
  enqueueHabitCommand,
  pendingHabitCommands,
  removeHabitCommand,
  type OfflineHabitCommand,
} from "@/features/habits/ui/habit-offline-queue";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

interface HabitsProps {
  readonly locale: Locale;
}

export function Habits({ locale }: HabitsProps) {
  const copy = getHabitCopy(locale);
  const auth = useAuth();
  const [view, setView] = useState<HabitListView | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (auth.status !== "authenticated" || !auth.session) return;
    setLoading(true);
    setError(null);
    try {
      await flushCommands(auth.session.accessToken);
      const response = habitListResponseSchema.parse(
        await authFetch<unknown>(
          "/api/v1/habits",
          {},
          auth.session.accessToken,
        ),
      );
      setView(response.data);
      setOffline(false);
      sessionStorage.setItem(
        cacheKey(auth.session.user.id),
        JSON.stringify(response.data),
      );
    } catch (caught) {
      const cached = readCache(auth.session.user.id);
      if (cached && !(caught instanceof AuthApiError)) {
        setView(cached);
        setOffline(true);
      } else setError(messageFor(caught, copy));
    } finally {
      setLoading(false);
    }
  }, [auth.session, auth.status, copy]);

  useEffect(() => {
    const task = window.setTimeout(() => {
      if (auth.status === "authenticated") void load();
      if (auth.status === "anonymous") setLoading(false);
    }, 0);
    const online = () => void load();
    window.addEventListener("online", online);
    return () => {
      window.clearTimeout(task);
      window.removeEventListener("online", online);
    };
  }, [auth.status, load]);

  async function mutation(
    path: string,
    method: string,
    body: unknown,
  ): Promise<HabitSummary | null> {
    if (!auth.session) return null;
    try {
      const response = habitResponseSchema.parse(
        await authFetch<unknown>(
          path,
          { method, body: JSON.stringify(body) },
          auth.session.accessToken,
        ),
      );
      setView((current) =>
        current ? replaceHabit(current, response.data) : current,
      );
      setError(null);
      return response.data;
    } catch (caught) {
      if (caught instanceof AuthApiError && caught.status === 409) {
        setNotice(copy.changedElsewhere);
        await load();
      } else setError(messageFor(caught, copy));
      return null;
    }
  }

  async function saveForm(payload: HabitFormPayload, habit?: HabitSummary) {
    if (!auth.session) return;
    setBusy(habit?.id ?? "create");
    const body = habit
      ? {
          title: payload.title,
          kind: payload.kind,
          target: payload.target,
          schedule: payload.schedule,
          effectiveOn: payload.date,
          expectedVersion: habit.version,
        }
      : {
          title: payload.title,
          kind: payload.kind,
          target: payload.target,
          schedule: payload.schedule,
          startsOn: payload.date,
          clientCommandId: crypto.randomUUID(),
        };
    const saved = await mutation(
      habit ? `/api/v1/habits/${habit.id}` : "/api/v1/habits",
      habit ? "PATCH" : "POST",
      body,
    );
    setBusy(null);
    if (saved) {
      setCreating(false);
      setEditing(null);
    }
  }

  async function checkIn(
    habit: HabitSummary,
    value: number | null,
    completed: boolean | null,
  ) {
    if (!auth.session || !view) return;
    const command: OfflineHabitCommand = {
      habitId: habit.id,
      localDate: view.localDate,
      value,
      completed,
      clientCommandId: crypto.randomUUID(),
      ...(habit.today?.entry
        ? { expectedVersion: habit.today.entry.version }
        : {}),
    };
    setBusy(habit.id);
    if (!navigator.onLine) {
      await enqueueHabitCommand(command);
      setNotice(copy.queued);
      setOffline(true);
      setBusy(null);
      return;
    }
    try {
      const response = habitResponseSchema.parse(
        await authFetch<unknown>(
          `/api/v1/habits/${habit.id}/entries`,
          {
            method: "POST",
            body: JSON.stringify({
              ...command,
              skippedReason: null,
              note: null,
              evidenceRef: null,
            }),
          },
          auth.session.accessToken,
        ),
      );
      setView((current) =>
        current ? replaceHabit(current, response.data) : current,
      );
    } catch (caught) {
      if (!(caught instanceof AuthApiError)) {
        await enqueueHabitCommand(command);
        setNotice(copy.queued);
        setOffline(true);
      } else if (caught.status === 409) {
        setNotice(copy.changedElsewhere);
        await load();
      } else setError(messageFor(caught, copy));
    } finally {
      setBusy(null);
    }
  }

  async function skipToday(habit: HabitSummary) {
    if (!view) return;
    setBusy(habit.id);
    await mutation(`/api/v1/habits/${habit.id}/entries`, "POST", {
      localDate: view.localDate,
      value: null,
      completed: false,
      skippedReason: "intentional_skip",
      note: null,
      evidenceRef: null,
      clientCommandId: crypto.randomUUID(),
      ...(habit.today?.entry
        ? { expectedVersion: habit.today.entry.version }
        : {}),
    });
    setBusy(null);
  }

  async function stateAction(
    habit: HabitSummary,
    action: "archive" | "restore" | "pause" | "resume",
  ) {
    setBusy(habit.id);
    const path = `/api/v1/habits/${habit.id}/${action === "restore" ? "archive" : action}`;
    const method = action === "restore" ? "DELETE" : "POST";
    await mutation(
      path,
      method,
      action === "pause"
        ? { expectedVersion: habit.version, reason: null }
        : { expectedVersion: habit.version },
    );
    setBusy(null);
  }

  async function undo(habit: HabitSummary) {
    if (!habit.today?.entry) return;
    setBusy(habit.id);
    await mutation(`/api/v1/habits/${habit.id}/entries/undo`, "POST", {
      expectedVersion: habit.today.entry.version,
      clientCommandId: crypto.randomUUID(),
    });
    setBusy(null);
  }

  if (auth.status === "loading" || (loading && !view)) return <HabitSkeleton />;
  if (auth.status === "anonymous")
    return <SignInState locale={locale} copy={copy} />;
  if (!view) return <Failure copy={copy} error={error} retry={load} />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
      <div aria-live="polite" className="sr-only">
        {notice ?? error}
      </div>
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--primary-text)]">
            {copy.eyebrow}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
            {copy.heading}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            {copy.subtitle}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label={copy.refresh}
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw
              className={cn(
                loading && "animate-spin motion-reduce:animate-none",
              )}
            />
          </Button>
          <Button
            onClick={() => {
              setCreating(true);
              setEditing(null);
            }}
          >
            <Plus />
            {copy.newHabit}
          </Button>
        </div>
      </header>

      {(offline || notice || error) && (
        <div
          role={error ? "alert" : "status"}
          className={cn(
            "mb-5 rounded-xl border px-4 py-3 text-sm",
            error
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-border bg-muted/60",
          )}
        >
          {offline && (
            <CloudOff aria-hidden="true" className="mr-2 inline size-4" />
          )}
          {error ?? notice ?? copy.offline}
        </div>
      )}

      {creating && (
        <Card className="focused-glass mb-6">
          <CardHeader>
            <CardTitle>{copy.newHabit}</CardTitle>
            <CardDescription>{copy.emptyBody}</CardDescription>
          </CardHeader>
          <CardContent>
            <HabitForm
              copy={copy}
              today={view.localDate}
              busy={busy === "create"}
              onCancel={() => setCreating(false)}
              onSubmit={(payload) => saveForm(payload)}
            />
          </CardContent>
        </Card>
      )}

      {view.active.length === 0 && !creating ? (
        <EmptyState copy={copy} begin={() => setCreating(true)} />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {view.active.map((habit) =>
            editing === habit.id ? (
              <Card key={habit.id} className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>{copy.edit}</CardTitle>
                </CardHeader>
                <CardContent>
                  <HabitForm
                    copy={copy}
                    today={view.localDate}
                    habit={habit}
                    busy={busy === habit.id}
                    onCancel={() => setEditing(null)}
                    onSubmit={(payload) => saveForm(payload, habit)}
                  />
                </CardContent>
              </Card>
            ) : (
              <HabitCard
                key={habit.id}
                habit={habit}
                copy={copy}
                accessToken={auth.session!.accessToken}
                busy={busy === habit.id}
                onEdit={() => {
                  setEditing(habit.id);
                  setCreating(false);
                }}
                onCheckIn={checkIn}
                onSkip={skipToday}
                onUndo={undo}
                onState={stateAction}
              />
            ),
          )}
        </div>
      )}

      {view.archived.length > 0 && (
        <details className="mt-8">
          <summary className="text-muted-foreground flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold">
            <Archive className="size-4" />
            {copy.archivedSection}
            <ChevronDown className="size-4" />
          </summary>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {view.archived.map((habit) => (
              <Card key={habit.id} className="opacity-75">
                <CardContent className="flex items-center justify-between gap-3 pt-6">
                  <div>
                    <p className="font-semibold">{habit.title}</p>
                    <p className="text-muted-foreground text-sm">
                      {copy.archived}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="compact"
                    disabled={busy === habit.id}
                    onClick={() => void stateAction(habit, "restore")}
                  >
                    <RotateCcw />
                    {copy.restore}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function HabitCard({
  habit,
  copy,
  accessToken,
  busy,
  onEdit,
  onCheckIn,
  onSkip,
  onUndo,
  onState,
}: Readonly<{
  habit: HabitSummary;
  copy: HabitCopy;
  accessToken: string;
  busy: boolean;
  onEdit(): void;
  onCheckIn(
    habit: HabitSummary,
    value: number | null,
    completed: boolean | null,
  ): Promise<void>;
  onSkip(habit: HabitSummary): Promise<void>;
  onUndo(habit: HabitSummary): Promise<void>;
  onState(
    habit: HabitSummary,
    action: "archive" | "restore" | "pause" | "resume",
  ): Promise<void>;
}>) {
  const occurrence = habit.today;
  const entryActive = occurrence?.entry && !occurrence.entry.undoneAt;
  const complete = occurrence?.status === "completed" && entryActive;
  const [amount, setAmount] = useState(
    habit.scheduleVersion.target.value?.toString() ?? "",
  );
  const status = habit.paused
    ? copy.excused
    : occurrence
      ? statusCopy(occurrence.status, copy)
      : copy.notDue;
  return (
    <Card
      className={cn(
        "overflow-hidden transition-shadow hover:shadow-[var(--shadow-md)]",
        complete && "border-primary/35",
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{habit.title}</CardTitle>
            <CardDescription>
              {copy.kinds[habit.kind]} ·{" "}
              {copy.schedules[habit.scheduleVersion.schedule.type]}
            </CardDescription>
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold",
              complete
                ? "bg-primary/12 text-primary"
                : "bg-muted text-muted-foreground",
            )}
          >
            {status}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-muted/55 mb-4 grid grid-cols-2 gap-3 rounded-xl p-3 text-sm">
          <div>
            <p className="text-muted-foreground">{copy.consistency}</p>
            <p className="mt-1 font-semibold">
              {habit.consistency.percentage}%
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{copy.streak}</p>
            <p className="mt-1 font-semibold">
              {habit.consistency.currentStreak}
            </p>
          </div>
        </div>
        <p className="text-muted-foreground mb-4 text-xs">
          {copy.reducedPressure}
        </p>
        {!habit.paused &&
          occurrence &&
          occurrence.status !== "excused" &&
          !complete &&
          (habit.kind === "count" || habit.kind === "duration") && (
            <div className="mb-3 flex gap-2">
              <Input
                aria-label={copy.value}
                type="number"
                min="0"
                max="1000000"
                step="any"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <Button
                disabled={busy || !amount || Number(amount) < 0}
                onClick={() => void onCheckIn(habit, Number(amount), null)}
              >
                <Check />
                {copy.complete}
              </Button>
            </div>
          )}
        <div className="flex flex-wrap gap-2">
          {!habit.paused &&
            occurrence &&
            occurrence.status !== "excused" &&
            (habit.kind === "boolean" || habit.kind === "avoidance") &&
            !complete && (
              <Button
                size="compact"
                disabled={busy}
                onClick={() => void onCheckIn(habit, null, true)}
              >
                <Check />
                {copy.complete}
              </Button>
            )}
          {!habit.paused &&
            occurrence &&
            occurrence.status === "due" &&
            !entryActive && (
              <Button
                variant="outline"
                size="compact"
                disabled={busy}
                onClick={() => void onSkip(habit)}
              >
                {copy.skip}
              </Button>
            )}
          {entryActive && (
            <Button
              variant="outline"
              size="compact"
              disabled={busy}
              onClick={() => void onUndo(habit)}
            >
              <RotateCcw />
              {copy.undo}
            </Button>
          )}
          <Button
            variant="ghost"
            size="compact"
            disabled={busy}
            onClick={onEdit}
          >
            <Pencil />
            {copy.edit}
          </Button>
          <Button
            variant="ghost"
            size="compact"
            disabled={busy}
            onClick={() =>
              void onState(habit, habit.paused ? "resume" : "pause")
            }
          >
            <Pause />
            {habit.paused ? copy.resume : copy.pause}
          </Button>
          <Button
            variant="ghost"
            size="compact"
            disabled={busy}
            onClick={() => void onState(habit, "archive")}
          >
            <Archive />
            {copy.archive}
          </Button>
        </div>
        <HabitHistory
          habitId={habit.id}
          accessToken={accessToken}
          copy={copy}
        />
      </CardContent>
    </Card>
  );
}

function HabitHistory({
  habitId,
  accessToken,
  copy,
}: Readonly<{ habitId: string; accessToken: string; copy: HabitCopy }>) {
  const [history, setHistory] = useState<HabitHistoryPage | null>(null);
  const [loading, setLoading] = useState(false);
  async function open(event: React.SyntheticEvent<HTMLDetailsElement>) {
    if (!event.currentTarget.open || history || loading) return;
    setLoading(true);
    try {
      const response = habitHistoryResponseSchema.parse(
        await authFetch<unknown>(
          `/api/v1/habits/${habitId}/entries`,
          {},
          accessToken,
        ),
      );
      setHistory(response.data);
    } finally {
      setLoading(false);
    }
  }
  return (
    <details
      className="border-border mt-4 border-t pt-2"
      onToggle={(event) => void open(event)}
    >
      <summary className="text-muted-foreground flex min-h-10 cursor-pointer list-none items-center gap-2 text-sm">
        <History className="size-4" />
        {copy.history}
        <ChevronDown className="ml-auto size-4" />
      </summary>
      {loading ? (
        <p className="text-muted-foreground py-3 text-sm">{copy.loading}</p>
      ) : history?.occurrences.length ? (
        <ol className="space-y-2 py-2">
          {history.occurrences.slice(0, 8).map((item) => (
            <li key={item.id} className="flex justify-between gap-3 text-sm">
              <time dateTime={item.localDate}>{item.localDate}</time>
              <span className="text-muted-foreground">
                {statusCopy(item.status, copy)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted-foreground py-3 text-sm">{copy.noHistory}</p>
      )}
    </details>
  );
}

function EmptyState({
  copy,
  begin,
}: Readonly<{ copy: HabitCopy; begin(): void }>) {
  return (
    <Card className="focused-glass border-dashed">
      <CardContent className="flex min-h-72 flex-col items-center justify-center text-center">
        <div className="bg-primary/10 text-primary mb-4 grid size-12 place-items-center rounded-2xl">
          <Plus />
        </div>
        <h2 className="text-xl font-semibold">{copy.emptyTitle}</h2>
        <p className="text-muted-foreground mt-2 max-w-md">{copy.emptyBody}</p>
        <Button className="mt-5" onClick={begin}>
          <Plus />
          {copy.newHabit}
        </Button>
      </CardContent>
    </Card>
  );
}

function SignInState({
  locale,
  copy,
}: Readonly<{ locale: Locale; copy: HabitCopy }>) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <Card>
        <CardHeader>
          <CardTitle>{copy.signInTitle}</CardTitle>
          <CardDescription>{copy.signInBody}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link className={buttonVariants()} href={`/${locale}/sign-in`}>
            {copy.signIn}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function Failure({
  copy,
  error,
  retry,
}: Readonly<{
  copy: HabitCopy;
  error: string | null;
  retry(): Promise<void>;
}>) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20">
      <Card>
        <CardHeader>
          <CardTitle>{copy.genericError}</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void retry()}>
            <RefreshCw />
            {copy.refresh}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function HabitSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-8 motion-reduce:animate-none">
      <div className="bg-muted h-4 w-28 rounded" />
      <div className="bg-muted mt-4 h-10 max-w-xl rounded" />
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="border-border bg-card h-64 rounded-2xl border"
          />
        ))}
      </div>
      <span className="sr-only">Loading habits</span>
    </div>
  );
}

async function flushCommands(accessToken: string): Promise<void> {
  for (const command of await pendingHabitCommands()) {
    await authFetch(
      `/api/v1/habits/${command.habitId}/entries`,
      {
        method: "POST",
        body: JSON.stringify({
          ...command,
          skippedReason: null,
          note: null,
          evidenceRef: null,
        }),
      },
      accessToken,
    );
    await removeHabitCommand(command.clientCommandId);
  }
}

function replaceHabit(view: HabitListView, habit: HabitSummary): HabitListView {
  const without = (items: readonly HabitSummary[]) =>
    items.filter((item) => item.id !== habit.id);
  return {
    ...view,
    active: habit.archived
      ? without(view.active)
      : [...without(view.active), habit],
    archived: habit.archived
      ? [...without(view.archived), habit]
      : without(view.archived),
  };
}

function statusCopy(
  status: "due" | "completed" | "skipped" | "excused",
  copy: HabitCopy,
) {
  return status === "due"
    ? copy.dueToday
    : status === "completed"
      ? copy.completed
      : status === "skipped"
        ? copy.skipped
        : copy.excused;
}
function cacheKey(userId: string) {
  return `focused:habits:${userId}`;
}
function readCache(userId: string): HabitListView | null {
  try {
    const value = sessionStorage.getItem(cacheKey(userId));
    return value
      ? habitListResponseSchema.shape.data.parse(JSON.parse(value))
      : null;
  } catch {
    return null;
  }
}
function messageFor(error: unknown, copy: HabitCopy) {
  return error instanceof AuthApiError && error.status === 409
    ? copy.syncConflict
    : error instanceof AuthApiError
      ? error.message
      : copy.genericError;
}
