"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
import type { WeeklyPlanView } from "@/features/goals/domain/goal-types";
import {
  weeklyPlanMutationResponseSchema,
  weeklyPlanResponseSchema,
} from "@/features/goals/transport/goal-schemas";
import type { Locale } from "@/i18n/config";

const formSchema = z.object({
  theme: z.string().trim().max(160),
  capacityHours: z.number().min(0).max(168),
  outcomes: z.string().max(4_000),
  commitments: z.string().max(4_000),
  notDoing: z.string().max(2_000),
  reflection: z.string().max(2_000),
});
type FormValue = z.infer<typeof formSchema>;

export function WeeklyPlan({ locale }: { readonly locale: Locale }) {
  const bn = locale === "bn-BD";
  const auth = useAuth();
  const weekStart = mondayIso(new Date());
  const [plan, setPlan] = useState<WeeklyPlanView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormValue>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      theme: "",
      capacityHours: 20,
      outcomes: "",
      commitments: "",
      notDoing: "",
      reflection: "",
    },
  });
  const load = useCallback(async () => {
    if (!auth.session) return;
    setLoading(true);
    try {
      const next = weeklyPlanResponseSchema.parse(
        await authFetch<unknown>(
          `/api/v1/weekly-plans/${weekStart}`,
          {},
          auth.session.accessToken,
        ),
      ).data;
      setPlan(next);
      if (next)
        form.reset({
          theme: next.theme ?? "",
          capacityHours: next.capacityMinutes / 60,
          outcomes: next.outcomes
            .map((item) => `${item.title} | ${item.estimateMinutes}`)
            .join("\n"),
          commitments: next.fixedCommitments
            .map((item) => `${item.title} | ${item.minutes}`)
            .join("\n"),
          notDoing: next.notDoing.join("\n"),
          reflection: next.reflection ?? "",
        });
    } catch (caught) {
      setError(
        caught instanceof AuthApiError
          ? caught.message
          : bn
            ? "সাপ্তাহিক পরিকল্পনা আনা যাচ্ছে না।"
            : "The weekly plan is unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }, [auth.session, bn, form, weekStart]);
  useEffect(() => {
    const task = window.setTimeout(() => {
      if (auth.status === "authenticated") void load();
      if (auth.status === "anonymous") setLoading(false);
    }, 0);
    return () => window.clearTimeout(task);
  }, [auth.status, load]);

  const save = form.handleSubmit(async (value) => {
    if (!auth.session) return;
    setBusy(true);
    setError(null);
    try {
      const outcomes = lines(value.outcomes).map((line) => {
        const timed = toTimed(line);
        return {
          goalId: null,
          title: timed.title,
          estimateMinutes: timed.minutes,
        };
      });
      const response = weeklyPlanMutationResponseSchema.parse(
        await authFetch<unknown>(
          `/api/v1/weekly-plans/${weekStart}`,
          {
            method: "PUT",
            body: JSON.stringify({
              weekStart,
              theme: value.theme || null,
              capacityMinutes: Math.round(value.capacityHours * 60),
              fixedCommitments: lines(value.commitments).map(toTimed),
              notDoing: lines(value.notDoing),
              reflection: value.reflection || null,
              outcomes,
              clientCommandId: crypto.randomUUID(),
              ...(plan ? { expectedVersion: plan.version } : {}),
            }),
          },
          auth.session.accessToken,
        ),
      );
      setPlan(response.data);
    } catch (caught) {
      setError(
        caught instanceof AuthApiError
          ? caught.message
          : bn
            ? "পরিকল্পনা সংরক্ষণ করা যায়নি।"
            : "The plan could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  });
  async function finalize() {
    if (!auth.session || !plan || plan.status !== "draft") return;
    setBusy(true);
    try {
      const response = weeklyPlanMutationResponseSchema.parse(
        await authFetch<unknown>(
          `/api/v1/weekly-plans/plans/${plan.id}/transition`,
          {
            method: "POST",
            body: JSON.stringify({
              toStatus: "active",
              expectedVersion: plan.version,
            }),
          },
          auth.session.accessToken,
        ),
      );
      setPlan(response.data);
    } catch (caught) {
      setError(
        caught instanceof AuthApiError
          ? caught.message
          : bn
            ? "Plan final করা যায়নি।"
            : "The plan could not be finalized.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (auth.status === "loading" || loading)
    return (
      <State title={bn ? "সপ্তাহটি সাজানো হচ্ছে" : "Preparing your week"} />
    );
  if (auth.status === "anonymous")
    return (
      <State
        title={
          bn
            ? "Weekly Plan দেখতে Sign in করুন"
            : "Sign in to see your Weekly Plan"
        }
      >
        <Link className={buttonVariants()} href={`/${locale}/sign-in`}>
          Sign in
        </Link>
      </State>
    );
  const locked = plan !== null && plan.status !== "draft";
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:py-10">
      <header>
        <p className="text-primary text-sm font-semibold">{weekStart}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {bn
            ? "এই সপ্তাহে কী সত্যিই গুরুত্বপূর্ণ?"
            : "What truly matters this week?"}
        </h1>
        <p className="text-muted-foreground mt-2">
          {bn
            ? "সামর্থ্য বুঝে অল্প কয়েকটি ফল বেছে নিন। সতর্কতা সিদ্ধান্তে সাহায্য করবে, কাজ আটকাবে না।"
            : "Choose a few outcomes within your capacity. Warnings inform without blocking you."}
        </p>
      </header>
      {error && (
        <div
          role="alert"
          className="border-destructive/30 text-destructive flex justify-between rounded-xl border p-3"
        >
          <span>{error}</span>
          <Button variant="ghost" size="compact" onClick={() => void load()}>
            <RefreshCw />
            {bn ? "আবার চেষ্টা" : "Retry"}
          </Button>
        </div>
      )}
      {plan?.warning === "over_capacity" && (
        <div
          role="status"
          className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
        >
          <AlertTriangle className="size-5 shrink-0 text-amber-600" />
          <span>
            {bn
              ? `আপনি ${plan.committedMinutes} মিনিট রেখেছেন, কিন্তু সামর্থ্য ${plan.capacityMinutes} মিনিট। চাইলে তবু Plan final করতে পারবেন।`
              : `You committed ${plan.committedMinutes} minutes against ${plan.capacityMinutes} minutes of capacity. You can still finalize.`}
          </span>
        </div>
      )}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Weekly Plan</CardTitle>
              <CardDescription>
                {plan
                  ? `${plan.status} · v${plan.version}`
                  : bn
                    ? "নতুন Draft"
                    : "New draft"}
              </CardDescription>
            </div>
            <CalendarCheck2 className="text-primary" aria-hidden="true" />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={bn ? "সপ্তাহের মূল ভাবনা" : "Theme for the week"}>
                <Input {...form.register("theme")} disabled={locked} />
              </Field>
              <Field
                label={
                  bn
                    ? "বাস্তবসম্মত সামর্থ্য (ঘণ্টা)"
                    : "Realistic capacity (hours)"
                }
              >
                <Input
                  type="number"
                  min="0"
                  max="168"
                  step="0.5"
                  {...form.register("capacityHours", { valueAsNumber: true })}
                  disabled={locked}
                />
              </Field>
            </div>
            <Field
              label={
                bn
                  ? "ফলাফল—প্রতি লাইনে: কাজ | মিনিট"
                  : "Outcomes—one per line: title | minutes"
              }
            >
              <textarea
                className={textareaClass}
                rows={5}
                {...form.register("outcomes")}
                disabled={locked}
              />
            </Field>
            <Field
              label={
                bn
                  ? "আগে থেকেই ঠিক থাকা সময়—নাম | মিনিট"
                  : "Fixed commitments—title | minutes"
              }
            >
              <textarea
                className={textareaClass}
                rows={3}
                {...form.register("commitments")}
                disabled={locked}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={bn ? "এই সপ্তাহে যা করব না" : "Not doing this week"}
              >
                <textarea
                  className={textareaClass}
                  rows={4}
                  {...form.register("notDoing")}
                  disabled={locked}
                />
              </Field>
              <Field
                label={
                  bn ? "আগের সপ্তাহ থেকে শেখা" : "Reflection from last week"
                }
              >
                <textarea
                  className={textareaClass}
                  rows={4}
                  {...form.register("reflection")}
                  disabled={locked}
                />
              </Field>
            </div>
            {!locked && (
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={busy}>
                  {bn ? "Draft সংরক্ষণ করুন" : "Save draft"}
                </Button>
                {plan && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void finalize()}
                  >
                    <CheckCircle2 />
                    {bn ? "Plan final করুন" : "Finalize plan"}
                  </Button>
                )}
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
function State({
  title,
  children,
}: {
  readonly title: string;
  readonly children?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-[70svh] place-items-center">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {children}
      </div>
    </div>
  );
}
function mondayIso(date: Date) {
  const next = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const day = next.getUTCDay();
  next.setUTCDate(next.getUTCDate() - (day === 0 ? 6 : day - 1));
  return next.toISOString().slice(0, 10);
}
function lines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}
function toTimed(value: string) {
  const [title = "", raw = "0"] = value.split("|");
  const minutes = Number(raw.trim());
  return {
    title: title.trim(),
    minutes: Number.isFinite(minutes) && minutes >= 0 ? Math.round(minutes) : 0,
  };
}
const textareaClass =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-y rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px] disabled:opacity-60";
