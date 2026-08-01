"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Archive,
  CheckCircle2,
  CloudOff,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Target,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { z } from "zod";

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
  GoalListView,
  GoalStatus,
  GoalView,
  LifeVisionView,
} from "@/features/goals/domain/goal-types";
import {
  goalListResponseSchema,
  goalResponseSchema,
  lifeVisionMutationResponseSchema,
  lifeVisionResponseSchema,
} from "@/features/goals/transport/goal-schemas";
import { getGoalCopy } from "@/features/goals/ui/goal-copy";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

const goalFormSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10_000),
  horizon: z.string().trim().min(1).max(30),
  targetDate: z.string(),
  manualProgress: z.number().min(0).max(100),
});
type GoalForm = z.infer<typeof goalFormSchema>;
const visionFormSchema = z.object({
  narrative: z.string().max(10_000),
  values: z.string().max(2_000),
  antiGoals: z.string().max(3_000),
  areaTitle: z.string().max(100),
  areaStatement: z.string().max(2_000),
});
type VisionForm = z.infer<typeof visionFormSchema>;

export function Goals({ locale }: { readonly locale: Locale }) {
  const copy = getGoalCopy(locale);
  const auth = useAuth();
  const [goals, setGoals] = useState<GoalListView | null>(null);
  const [vision, setVision] = useState<LifeVisionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const goalForm = useForm<GoalForm>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      title: "",
      description: "",
      horizon: "year",
      targetDate: "",
      manualProgress: 0,
    },
  });
  const visionForm = useForm<VisionForm>({
    resolver: zodResolver(visionFormSchema),
    defaultValues: {
      narrative: "",
      values: "",
      antiGoals: "",
      areaTitle: "",
      areaStatement: "",
    },
  });

  const load = useCallback(async () => {
    if (!auth.session) return;
    setLoading(true);
    setError(null);
    try {
      const [goalPayload, visionPayload] = await Promise.all([
        authFetch<unknown>("/api/v1/goals", {}, auth.session.accessToken),
        authFetch<unknown>("/api/v1/life-vision", {}, auth.session.accessToken),
      ]);
      const nextGoals = goalListResponseSchema.parse(goalPayload).data;
      const nextVision = lifeVisionResponseSchema.parse(visionPayload).data;
      setGoals(nextGoals);
      setVision(nextVision);
      setOffline(false);
      sessionStorage.setItem(
        cacheKey(auth.session.user.id),
        JSON.stringify(nextGoals),
      );
      if (nextVision)
        visionForm.reset({
          narrative: nextVision.narrative ?? "",
          values: nextVision.values.join(", "),
          antiGoals: nextVision.antiGoals.join(", "),
          areaTitle: nextVision.areas[0]?.title ?? "",
          areaStatement: nextVision.areas[0]?.statement ?? "",
        });
    } catch (caught) {
      const cached = readCachedGoals(auth.session.user.id);
      if (cached && !(caught instanceof AuthApiError)) {
        setGoals(cached);
        setOffline(true);
      } else
        setError(
          caught instanceof AuthApiError ? caught.message : copy.unavailable,
        );
    } finally {
      setLoading(false);
    }
  }, [auth.session, copy.unavailable, visionForm]);

  useEffect(() => {
    const task = window.setTimeout(() => {
      if (auth.status === "authenticated") void load();
      if (auth.status === "anonymous") setLoading(false);
    }, 0);
    return () => window.clearTimeout(task);
  }, [auth.status, load]);

  const create = goalForm.handleSubmit(async (value) => {
    if (!auth.session || offline) return;
    setBusy("create");
    setError(null);
    try {
      const response = goalResponseSchema.parse(
        await authFetch<unknown>(
          "/api/v1/goals",
          {
            method: "POST",
            body: JSON.stringify({
              parentGoalId: null,
              title: value.title,
              description: value.description || null,
              horizon: value.horizon,
              priority: 2,
              progressMode: "manual",
              manualProgress: value.manualProgress,
              successMeasure: null,
              targetValue: null,
              targetUnit: null,
              targetDate: value.targetDate || null,
              clientCommandId: crypto.randomUUID(),
            }),
          },
          auth.session.accessToken,
        ),
      );
      setGoals((current) =>
        current
          ? {
              ...current,
              data: [response.data, ...current.data],
              total: current.total + 1,
            }
          : { data: [response.data], total: 1, nextCursor: null },
      );
      goalForm.reset();
      setCreating(false);
      setNotice(copy.saved);
    } catch (caught) {
      setError(message(caught, copy.unavailable));
    } finally {
      setBusy(null);
    }
  });

  async function transition(goal: GoalView, toStatus: GoalStatus) {
    if (!auth.session || offline) return;
    setBusy(goal.id);
    setError(null);
    try {
      const response = goalResponseSchema.parse(
        await authFetch<unknown>(
          `/api/v1/goals/${goal.id}/transition`,
          {
            method: "POST",
            body: JSON.stringify({
              toStatus,
              reason: null,
              confirmCompletion: toStatus === "achieved",
              clientCommandId: crypto.randomUUID(),
              expectedVersion: goal.version,
            }),
          },
          auth.session.accessToken,
        ),
      );
      replaceGoal(response.data);
      setNotice(copy.saved);
    } catch (caught) {
      setError(message(caught, copy.unavailable));
    } finally {
      setBusy(null);
    }
  }

  async function checkIn(goal: GoalView) {
    if (!auth.session || offline) return;
    const raw = window.prompt(copy.progress, String(goal.progress));
    if (raw === null) return;
    const progress = Number(raw);
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
      setError(copy.progress);
      return;
    }
    setBusy(goal.id);
    try {
      const response = goalResponseSchema.parse(
        await authFetch<unknown>(
          `/api/v1/goals/${goal.id}/check-ins`,
          {
            method: "POST",
            body: JSON.stringify({
              progress,
              value: null,
              note: null,
              evidenceRef: null,
              clientCommandId: crypto.randomUUID(),
              expectedVersion: goal.version,
            }),
          },
          auth.session.accessToken,
        ),
      );
      replaceGoal(response.data);
      setNotice(copy.saved);
    } catch (caught) {
      setError(message(caught, copy.unavailable));
    } finally {
      setBusy(null);
    }
  }

  const saveVision = visionForm.handleSubmit(async (value) => {
    if (!auth.session || offline) return;
    setBusy("vision");
    const areas = value.areaTitle.trim()
      ? [
          {
            key: "primary",
            title: value.areaTitle.trim(),
            statement: value.areaStatement.trim() || null,
          },
        ]
      : [];
    try {
      const response = lifeVisionMutationResponseSchema.parse(
        await authFetch<unknown>(
          "/api/v1/life-vision",
          {
            method: "PUT",
            body: JSON.stringify({
              narrative: value.narrative.trim() || null,
              values: csv(value.values),
              antiGoals: csv(value.antiGoals),
              areas,
              clientCommandId: crypto.randomUUID(),
              ...(vision?.status === "draft"
                ? { expectedVersion: vision.version }
                : {}),
            }),
          },
          auth.session.accessToken,
        ),
      );
      setVision(response.data);
      setNotice(copy.saved);
    } catch (caught) {
      setError(message(caught, copy.unavailable));
    } finally {
      setBusy(null);
    }
  });

  async function publishVision() {
    if (!auth.session || !vision || vision.status !== "draft" || offline)
      return;
    setBusy("vision");
    try {
      const response = lifeVisionMutationResponseSchema.parse(
        await authFetch<unknown>(
          `/api/v1/life-vision/${vision.id}/publish`,
          {
            method: "POST",
            body: JSON.stringify({
              expectedVersion: vision.version,
              clientCommandId: crypto.randomUUID(),
            }),
          },
          auth.session.accessToken,
        ),
      );
      setVision(response.data);
      setNotice(copy.saved);
    } catch (caught) {
      setError(message(caught, copy.unavailable));
    } finally {
      setBusy(null);
    }
  }

  function replaceGoal(goal: GoalView) {
    setGoals((current) =>
      current
        ? {
            ...current,
            data: current.data.map((item) =>
              item.id === goal.id ? goal : item,
            ),
          }
        : current,
    );
  }

  if (auth.status === "loading" || loading)
    return (
      <PageState title={copy.loading}>
        <span className="bg-primary/70 size-6 animate-pulse rounded-full" />
      </PageState>
    );
  if (auth.status === "anonymous")
    return (
      <PageState title={copy.signInTitle}>
        <p className="text-muted-foreground max-w-lg">{copy.signInBody}</p>
        <Link className={buttonVariants()} href={`/${locale}/sign-in`}>
          {copy.signIn}
        </Link>
      </PageState>
    );

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-foreground text-sm font-semibold">
            {copy.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {copy.pageTitle}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl">{copy.intro}</p>
        </div>
        <Button
          onClick={() => setCreating((value) => !value)}
          disabled={offline}
        >
          <Plus aria-hidden="true" />
          {creating ? copy.cancel : copy.newGoal}
        </Button>
      </header>
      {offline && (
        <div
          role="status"
          className="border-border bg-muted/50 flex gap-2 rounded-xl border p-3 text-sm"
        >
          <CloudOff className="size-5 shrink-0" aria-hidden="true" />
          {copy.cached}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive flex items-center justify-between rounded-xl border p-3 text-sm"
        >
          <span>{error}</span>
          <Button variant="ghost" size="compact" onClick={() => void load()}>
            <RefreshCw aria-hidden="true" />
            {copy.retry}
          </Button>
        </div>
      )}
      {notice && (
        <p role="status" className="text-sm text-emerald-600">
          {notice}
        </p>
      )}
      {creating && (
        <GoalFormCard
          copy={copy}
          form={goalForm}
          submit={create}
          busy={busy === "create"}
        />
      )}
      <section aria-labelledby="goals-heading">
        <h2 id="goals-heading" className="mb-4 text-xl font-semibold">
          {copy.goals}
        </h2>
        {goals?.data.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {goals.data.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                copy={copy}
                busy={busy === goal.id}
                offline={offline}
                transition={transition}
                checkIn={checkIn}
              />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardHeader>
              <div className="bg-primary/10 text-primary mb-2 grid size-11 place-items-center rounded-2xl">
                <Target aria-hidden="true" />
              </div>
              <CardTitle>{copy.emptyTitle}</CardTitle>
              <CardDescription>{copy.emptyBody}</CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>
      <section aria-labelledby="vision-heading">
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-br from-fuchsia-500/10 to-purple-500/5">
            <CardTitle id="vision-heading">{copy.lifeVision}</CardTitle>
            <CardDescription>{copy.visionIntro}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveVision} className="grid gap-4 pt-2">
              <Field
                label={copy.narrative}
                error={visionForm.formState.errors.narrative?.message}
              >
                <textarea
                  className={textareaClass}
                  rows={5}
                  {...visionForm.register("narrative")}
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={copy.values}>
                  <Input {...visionForm.register("values")} />
                </Field>
                <Field label={copy.antiGoals}>
                  <Input {...visionForm.register("antiGoals")} />
                </Field>
                <Field label={copy.areaTitle}>
                  <Input {...visionForm.register("areaTitle")} />
                </Field>
                <Field label={copy.areaStatement}>
                  <Input {...visionForm.register("areaStatement")} />
                </Field>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={busy === "vision" || offline}>
                  {copy.saveDraft}
                </Button>
                {vision?.status === "draft" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void publishVision()}
                    disabled={busy === "vision" || offline}
                  >
                    <CheckCircle2 aria-hidden="true" />
                    {copy.publish}
                  </Button>
                )}
                <span className="text-muted-foreground self-center text-xs">
                  {vision
                    ? `Revision ${vision.revision} · ${vision.status}`
                    : "Draft"}
                </span>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function GoalFormCard({
  copy,
  form,
  submit,
  busy,
}: {
  readonly copy: ReturnType<typeof getGoalCopy>;
  readonly form: UseFormReturn<GoalForm>;
  readonly submit: () => void;
  readonly busy: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.newGoal}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <Field
            label={copy.title}
            error={form.formState.errors.title?.message}
          >
            <Input autoFocus {...form.register("title")} />
          </Field>
          <Field label={copy.horizon}>
            <select className={inputClass} {...form.register("horizon")}>
              <option value="year">১ বছর</option>
              <option value="quarter">৩ মাস</option>
              <option value="long_term">দীর্ঘমেয়াদি</option>
            </select>
          </Field>
          <Field label={copy.description}>
            <Input {...form.register("description")} />
          </Field>
          <Field label={copy.targetDate}>
            <Input type="date" {...form.register("targetDate")} />
          </Field>
          <Field label={copy.progress}>
            <Input
              type="number"
              min="0"
              max="100"
              {...form.register("manualProgress", { valueAsNumber: true })}
            />
          </Field>
          <div className="flex items-end">
            <Button type="submit" disabled={busy}>
              {copy.save}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function GoalCard({
  goal,
  copy,
  busy,
  offline,
  transition,
  checkIn,
}: {
  readonly goal: GoalView;
  readonly copy: ReturnType<typeof getGoalCopy>;
  readonly busy: boolean;
  readonly offline: boolean;
  transition(goal: GoalView, status: GoalStatus): Promise<void>;
  checkIn(goal: GoalView): Promise<void>;
}) {
  return (
    <Card
      className={cn(
        "transition-transform hover:-translate-y-0.5",
        goal.overdue && "border-amber-500/40",
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{goal.title}</CardTitle>
            <CardDescription className="mt-1">
              {goal.horizon}
              {goal.targetDate ? ` · ${goal.targetDate}` : ""}
            </CardDescription>
          </div>
          <span className="bg-muted rounded-full px-2.5 py-1 text-xs">
            {goal.status}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1.5 flex justify-between text-sm">
            <span>{copy.progress}</span>
            <strong>{goal.progress}%</strong>
          </div>
          <div
            className="bg-muted h-2 overflow-hidden rounded-full"
            role="progressbar"
            aria-label={`${goal.title}: ${copy.progress}`}
            aria-valuenow={goal.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="from-primary h-full rounded-full bg-gradient-to-r to-purple-500 transition-[width]"
              style={{ width: `${goal.progress}%` }}
            />
          </div>
          {goal.overdue && (
            <p className="mt-2 text-xs text-amber-600">{copy.overdue}</p>
          )}
        </div>
        {goal.description && (
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {goal.description}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            size="compact"
            variant="outline"
            onClick={() => void checkIn(goal)}
            disabled={
              busy ||
              offline ||
              !["active", "paused", "draft"].includes(goal.status)
            }
          >
            {copy.checkIn}
          </Button>
          {goal.status === "draft" || goal.status === "paused" ? (
            <Button
              size="compact"
              onClick={() => void transition(goal, "active")}
              disabled={busy || offline}
            >
              <Play aria-hidden="true" />
              {copy.activate}
            </Button>
          ) : null}
          {goal.status === "active" && (
            <>
              <Button
                size="compact"
                variant="outline"
                onClick={() => void transition(goal, "paused")}
                disabled={busy || offline}
              >
                <Pause aria-hidden="true" />
                {copy.pause}
              </Button>
              <Button
                size="compact"
                onClick={() => void transition(goal, "achieved")}
                disabled={busy || offline}
              >
                <CheckCircle2 aria-hidden="true" />
                {copy.complete}
              </Button>
            </>
          )}{" "}
          {!goal.archived && (
            <Button
              size="compact"
              variant="ghost"
              onClick={() => void transition(goal, "archived")}
              disabled={busy || offline}
            >
              <Archive aria-hidden="true" />
              {copy.archive}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  error,
  children,
}:
  | {
      readonly label: string;
      readonly error: string | undefined;
      readonly children: React.ReactNode;
    }
  | {
      readonly label: string;
      readonly error?: never;
      readonly children: React.ReactNode;
    }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
      {error && <span className="text-destructive text-xs">{error}</span>}
    </label>
  );
}
function PageState({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-[70svh] place-items-center px-4">
      <div className="flex max-w-xl flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {children}
      </div>
    </div>
  );
}
function csv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
function cacheKey(userId: string) {
  return `focused:goals:${userId}:v1`;
}
function readCachedGoals(userId: string): GoalListView | null {
  try {
    return JSON.parse(
      sessionStorage.getItem(cacheKey(userId)) ?? "null",
    ) as GoalListView | null;
  } catch {
    return null;
  }
}
function message(error: unknown, fallback: string) {
  return error instanceof AuthApiError ? error.message : fallback;
}
const inputClass =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]";
const textareaClass =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-28 w-full resize-y rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]";
