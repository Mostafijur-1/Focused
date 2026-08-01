"use client";

import {
  AlarmClock,
  Brain,
  CheckCircle2,
  CircleStop,
  CloudOff,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

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
import { defaultPomodoroConfig } from "@/features/focus/domain/focus-policy";
import type {
  FocusOverview,
  FocusSessionView,
  InterruptionCategory,
  PomodoroConfig,
} from "@/features/focus/domain/focus-types";
import {
  focusOverviewResponseSchema,
  focusResponseSchema,
  presetResponseSchema,
} from "@/features/focus/transport/focus-schemas";
import { getFocusCopy, type FocusCopy } from "@/features/focus/ui/focus-copy";
import {
  enqueueFocusCommand,
  pendingFocusCommands,
  removeFocusCommand,
} from "@/features/focus/ui/focus-offline-queue";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

interface FocusTimerProps {
  readonly locale: Locale;
}

export function FocusTimer({ locale }: FocusTimerProps) {
  const copy = getFocusCopy(locale);
  const auth = useAuth();
  const [overview, setOverview] = useState<FocusOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (auth.status !== "authenticated" || !auth.session) return;
    setLoading(true);
    setError(null);
    try {
      await flushOffline(auth.session.accessToken);
      const response = focusOverviewResponseSchema.parse(
        await authFetch<unknown>(
          "/api/v1/focus-sessions",
          {},
          auth.session.accessToken,
        ),
      );
      setOverview(response.data);
      setOffline(false);
      sessionStorage.setItem(
        cacheKey(auth.session.user.id),
        JSON.stringify({ cachedAt: Date.now(), data: response.data }),
      );
    } catch (caught) {
      const cached = readCache(auth.session.user.id);
      if (cached && !(caught instanceof AuthApiError)) {
        setOverview(cached);
        setOffline(true);
      } else setError(errorMessage(caught, copy));
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
    const visible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearTimeout(task);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [auth.status, load]);

  if (auth.status === "loading" || loading) return <LoadingState copy={copy} />;
  if (auth.status === "anonymous")
    return <SignedOutState locale={locale} copy={copy} />;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="mb-7">
        <p className="text-primary text-sm font-semibold tracking-wide">
          FocusOS
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {copy.pageTitle}
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-6 sm:text-base">
          {copy.pageDescription}
        </p>
      </header>

      {offline && <StatusBanner icon={CloudOff}>{copy.offline}</StatusBanner>}
      {notice && <StatusBanner>{notice}</StatusBanner>}
      {error && (
        <StatusBanner tone="error" icon={TriangleAlert}>
          <span>{error}</span>
          <Button variant="ghost" size="compact" onClick={() => void load()}>
            <RefreshCw aria-hidden="true" /> {copy.retry}
          </Button>
        </StatusBanner>
      )}

      {overview?.active ? (
        <ActiveTimer
          key={`${overview.active.id}:${overview.active.serverNow}`}
          session={overview.active}
          copy={copy}
          busy={busy}
          setBusy={setBusy}
          onUpdate={(session) =>
            setOverview((current) =>
              current ? { ...current, active: session } : current,
            )
          }
          onTerminal={(session) =>
            setOverview((current) =>
              current
                ? {
                    ...current,
                    active: null,
                    recent: [session, ...current.recent].slice(0, 20),
                  }
                : current,
            )
          }
          accessToken={auth.session!.accessToken}
          onConflict={async () => {
            setNotice(copy.changedElsewhere);
            await load();
          }}
          onQueued={() => {
            setOffline(true);
            setNotice(copy.queued);
          }}
          onError={(message) => setError(message)}
        />
      ) : (
        <StartFocusForm
          overview={overview}
          copy={copy}
          accessToken={auth.session!.accessToken}
          busy={busy === "start"}
          onBusy={(value) => setBusy(value ? "start" : null)}
          onStarted={(session) =>
            setOverview((current) =>
              current ? { ...current, active: session } : current,
            )
          }
          onError={(message) => setError(message)}
        />
      )}

      <RecentSessions
        sessions={overview?.recent ?? []}
        copy={copy}
        locale={locale}
      />
    </div>
  );
}

interface StartValues {
  intent: string;
  kind: "deep_work" | "pomodoro" | "custom";
  durationMinutes: number;
  goalId: string;
  presetId: string;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cycles: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  audioEnabled: boolean;
  vibrationEnabled: boolean;
  savePreset: boolean;
  presetName: string;
}

function StartFocusForm({
  overview,
  copy,
  accessToken,
  busy,
  onBusy,
  onStarted,
  onError,
}: Readonly<{
  overview: FocusOverview | null;
  copy: FocusCopy;
  accessToken: string;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onStarted: (session: FocusSessionView) => void;
  onError: (message: string) => void;
}>) {
  const { register, handleSubmit, control, setValue, formState } =
    useForm<StartValues>({
      defaultValues: {
        intent: "",
        kind: "deep_work",
        durationMinutes: 50,
        goalId: "",
        presetId: "",
        focusMinutes: defaultPomodoroConfig.focusSeconds / 60,
        shortBreakMinutes: defaultPomodoroConfig.shortBreakSeconds / 60,
        longBreakMinutes: defaultPomodoroConfig.longBreakSeconds / 60,
        cycles: defaultPomodoroConfig.cycles,
        autoStartBreaks: false,
        autoStartFocus: false,
        audioEnabled: true,
        vibrationEnabled: false,
        savePreset: false,
        presetName: "",
      },
    });
  const mode = useWatch({ control, name: "kind" });
  const presetId = useWatch({ control, name: "presetId" });
  const savePreset = useWatch({ control, name: "savePreset" });

  useEffect(() => {
    if (!presetId) return;
    const preset = overview?.presets.find(
      (candidate) => candidate.id === presetId,
    );
    if (!preset) return;
    setValue("focusMinutes", preset.focusSeconds / 60);
    setValue("shortBreakMinutes", preset.shortBreakSeconds / 60);
    setValue("longBreakMinutes", preset.longBreakSeconds / 60);
    setValue("cycles", preset.cycles);
    setValue("autoStartBreaks", preset.autoStartBreaks);
    setValue("autoStartFocus", preset.autoStartFocus);
    setValue("audioEnabled", preset.audioEnabled);
    setValue("vibrationEnabled", preset.vibrationEnabled);
  }, [overview?.presets, presetId, setValue]);

  const submit = handleSubmit(async (values) => {
    onBusy(true);
    onError("");
    try {
      const config: PomodoroConfig | null =
        values.kind === "pomodoro"
          ? {
              focusSeconds: values.focusMinutes * 60,
              shortBreakSeconds: values.shortBreakMinutes * 60,
              longBreakSeconds: values.longBreakMinutes * 60,
              cycles: values.cycles,
              longBreakEvery: Math.min(4, values.cycles),
              autoStartBreaks: values.autoStartBreaks,
              autoStartFocus: values.autoStartFocus,
              audioEnabled: values.audioEnabled,
              vibrationEnabled: values.vibrationEnabled,
            }
          : null;
      let selectedPresetId = values.presetId || null;
      if (values.kind === "pomodoro" && values.savePreset && config) {
        const preset = presetResponseSchema.parse(
          await authFetch<unknown>(
            "/api/v1/pomodoro-presets",
            {
              method: "POST",
              body: JSON.stringify({
                name: values.presetName,
                config,
                isDefault: false,
                clientCommandId: crypto.randomUUID(),
              }),
            },
            accessToken,
          ),
        );
        selectedPresetId = preset.data.id;
      }
      const response = focusResponseSchema.parse(
        await authFetch<unknown>(
          "/api/v1/focus-sessions",
          {
            method: "POST",
            body: JSON.stringify({
              kind: values.kind,
              intent: values.intent,
              plannedSeconds:
                values.kind === "pomodoro"
                  ? values.focusMinutes * 60
                  : values.durationMinutes * 60,
              goalId: values.goalId || null,
              pomodoroPresetId: selectedPresetId,
              pomodoroConfig: config,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              clientCommandId: crypto.randomUUID(),
            }),
          },
          accessToken,
        ),
      );
      onStarted(response.data);
    } catch (caught) {
      onError(errorMessage(caught, copy));
    } finally {
      onBusy(false);
    }
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-border/70 border-b">
        <CardTitle>{copy.startTitle}</CardTitle>
        <CardDescription>{copy.startDescription}</CardDescription>
      </CardHeader>
      <CardContent className="p-5 sm:p-6">
        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-5">
            <Field
              label={copy.intent}
              {...(formState.errors.intent?.message
                ? { error: formState.errors.intent.message }
                : {})}
            >
              <Input
                {...register("intent", {
                  required: true,
                  minLength: 1,
                  maxLength: 300,
                })}
                placeholder={copy.intentPlaceholder}
                autoComplete="off"
                aria-invalid={Boolean(formState.errors.intent)}
              />
            </Field>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">{copy.mode}</legend>
              <div className="grid grid-cols-3 gap-2">
                {(["deep_work", "pomodoro", "custom"] as const).map((kind) => (
                  <label
                    key={kind}
                    className={cn(
                      "border-border flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 text-center text-sm font-medium transition-colors",
                      mode === kind &&
                        "border-primary bg-primary/10 text-primary",
                    )}
                  >
                    <input
                      {...register("kind")}
                      type="radio"
                      value={kind}
                      className="sr-only"
                    />
                    {kind === "deep_work"
                      ? copy.deepWork
                      : kind === "pomodoro"
                        ? copy.pomodoro
                        : copy.custom}
                  </label>
                ))}
              </div>
            </fieldset>
            {mode !== "pomodoro" && (
              <Field label={`${copy.duration} (${copy.minutes})`}>
                <Input
                  {...register("durationMinutes", {
                    valueAsNumber: true,
                    min: 1,
                    max: 720,
                  })}
                  type="number"
                  min={1}
                  max={720}
                  inputMode="numeric"
                />
              </Field>
            )}
            <Field label={copy.linkedGoal}>
              <select {...register("goalId")} className={selectClass}>
                <option value="">{copy.noGoal}</option>
                {overview?.goalOptions.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="bg-muted/35 rounded-2xl p-4 sm:p-5">
            {mode === "pomodoro" ? (
              <PomodoroFields
                copy={copy}
                register={register}
                presets={overview?.presets ?? []}
                savePreset={savePreset}
              />
            ) : (
              <div className="flex h-full min-h-52 flex-col items-center justify-center text-center">
                <Brain className="text-primary size-10" aria-hidden="true" />
                <p className="mt-4 max-w-sm text-sm leading-6">
                  {copy.noBackgroundPromise}
                </p>
              </div>
            )}
          </div>
          <div className="lg:col-span-2">
            <Button
              type="submit"
              variant="primary"
              size="large"
              disabled={busy}
              className="w-full sm:w-auto"
            >
              <Play aria-hidden="true" /> {busy ? copy.starting : copy.begin}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function PomodoroFields({
  copy,
  register,
  presets,
  savePreset,
}: Readonly<{
  copy: FocusCopy;
  register: ReturnType<typeof useForm<StartValues>>["register"];
  presets: FocusOverview["presets"];
  savePreset: boolean;
}>) {
  return (
    <div className="space-y-4">
      <h2 className="font-semibold">{copy.pomodoroSettings}</h2>
      <Field label={copy.preset}>
        <select {...register("presetId")} className={selectClass}>
          <option value="">{copy.customPreset}</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <MinuteField
          name="focusMinutes"
          label={copy.focusMinutes}
          register={register}
          max={180}
        />
        <MinuteField
          name="shortBreakMinutes"
          label={copy.shortBreakMinutes}
          register={register}
          max={60}
        />
        <MinuteField
          name="longBreakMinutes"
          label={copy.longBreakMinutes}
          register={register}
          max={120}
        />
        <MinuteField
          name="cycles"
          label={copy.cycles}
          register={register}
          max={12}
        />
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <CheckField
          label={copy.autoStartBreaks}
          input={<input type="checkbox" {...register("autoStartBreaks")} />}
        />
        <CheckField
          label={copy.autoStartFocus}
          input={<input type="checkbox" {...register("autoStartFocus")} />}
        />
        <CheckField
          label={copy.sound}
          input={<input type="checkbox" {...register("audioEnabled")} />}
        />
        <CheckField
          label={copy.vibration}
          input={<input type="checkbox" {...register("vibrationEnabled")} />}
        />
      </div>
      <CheckField
        label={copy.savePreset}
        input={<input type="checkbox" {...register("savePreset")} />}
      />
      {savePreset && (
        <Field label={copy.presetName}>
          <Input
            {...register("presetName", { required: savePreset, maxLength: 80 })}
          />
        </Field>
      )}
    </div>
  );
}

function ActiveTimer({
  session,
  copy,
  busy,
  setBusy,
  onUpdate,
  onTerminal,
  accessToken,
  onConflict,
  onQueued,
  onError,
}: Readonly<{
  session: FocusSessionView;
  copy: FocusCopy;
  busy: string | null;
  setBusy: (value: string | null) => void;
  onUpdate: (session: FocusSessionView) => void;
  onTerminal: (session: FocusSessionView) => void;
  accessToken: string;
  onConflict: () => Promise<void>;
  onQueued: () => void;
  onError: (message: string) => void;
}>) {
  const [now, setNow] = useState(() => Date.now());
  const [review, setReview] = useState<"completion" | "abandonment" | null>(
    null,
  );
  const [outcome, setOutcome] = useState("");
  const [logging, setLogging] = useState(false);
  const [category, setCategory] =
    useState<InterruptionCategory>("notification");
  const [note, setNote] = useState("");
  const announced = useRef<string | null>(null);
  const [receivedAt] = useState(() => Date.now());
  const interval = session.activeInterval;
  const clientElapsed = Math.max(0, Math.floor((now - receivedAt) / 1_000));
  const remaining = interval
    ? session.status === "paused"
      ? interval.remainingSeconds
      : Math.max(0, interval.remainingSeconds - clientElapsed)
    : 0;
  const overtime = interval
    ? session.status === "paused"
      ? interval.overtimeSeconds
      : Math.max(0, clientElapsed - interval.remainingSeconds)
    : 0;
  const ready = Boolean(interval && remaining === 0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ready || !interval || announced.current === interval.id) return;
    announced.current = interval.id;
    if (session.pomodoroConfig?.audioEnabled) playTone();
    if (session.pomodoroConfig?.vibrationEnabled && "vibrate" in navigator)
      navigator.vibrate([150, 80, 150]);
  }, [interval, ready, session.pomodoroConfig]);

  async function mutate(
    path: string,
    body: Record<string, unknown>,
    terminal = false,
  ) {
    const command = {
      ...body,
      expectedVersion: session.version,
      clientCommandId: crypto.randomUUID(),
    };
    setBusy(path);
    onError("");
    if (terminal && !navigator.onLine) {
      await enqueueFocusCommand({
        clientCommandId: command.clientCommandId,
        sessionId: session.id,
        action: path as "completion" | "abandonment",
        expectedVersion: session.version,
        outcome: typeof body.outcome === "string" ? body.outcome : null,
      });
      onQueued();
      setBusy(null);
      return;
    }
    try {
      const response = focusResponseSchema.parse(
        await authFetch<unknown>(
          `/api/v1/focus-sessions/${session.id}/${path}`,
          { method: "POST", body: JSON.stringify(command) },
          accessToken,
        ),
      );
      if (["completed", "abandoned"].includes(response.data.status))
        onTerminal(response.data);
      else onUpdate(response.data);
      setReview(null);
      setLogging(false);
      setOutcome("");
      setNote("");
    } catch (caught) {
      if (caught instanceof AuthApiError && caught.status === 409)
        await onConflict();
      else if (terminal && !(caught instanceof AuthApiError)) {
        await enqueueFocusCommand({
          clientCommandId: command.clientCommandId,
          sessionId: session.id,
          action: path as "completion" | "abandonment",
          expectedVersion: session.version,
          outcome: typeof body.outcome === "string" ? body.outcome : null,
        });
        onQueued();
      } else onError(errorMessage(caught, copy));
    } finally {
      setBusy(null);
    }
  }

  const phaseLabel =
    interval?.kind === "short_break"
      ? copy.shortBreak
      : interval?.kind === "long_break"
        ? copy.longBreak
        : copy.focusPhase;
  return (
    <Card className="sticky top-3 z-20 overflow-hidden shadow-[0_20px_80px_-38px_color-mix(in_oklab,var(--primary)_55%,transparent)]">
      <CardContent className="p-5 sm:p-8">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="bg-primary/10 text-primary rounded-full px-3 py-1 font-medium">
                {phaseLabel}
              </span>
              <span className="text-muted-foreground">
                {session.status === "paused" ? copy.paused : copy.running}
              </span>
              {session.kind === "pomodoro" &&
                interval &&
                session.pomodoroConfig && (
                  <span className="text-muted-foreground">
                    {copy.cycle(
                      interval.cycleNumber,
                      session.pomodoroConfig.cycles,
                    )}
                  </span>
                )}
            </div>
            <h2 className="mt-4 text-xl font-semibold sm:text-2xl">
              {session.intent}
            </h2>
            {session.goalTitle && (
              <p className="text-muted-foreground mt-2 text-sm">
                {session.goalTitle}
              </p>
            )}
            <div
              className="mt-6 font-mono text-6xl leading-none font-semibold tracking-[-0.06em] tabular-nums sm:text-8xl"
              aria-label={formatClock(remaining)}
            >
              {formatClock(remaining)}
            </div>
            {overtime > 0 && (
              <p className="text-primary mt-3 text-sm font-medium">
                {copy.overtime} · +{formatClock(overtime)}
              </p>
            )}
            <p className="sr-only" aria-live="polite">
              {ready ? copy.timerReady : ""}
            </p>
          </div>
          <div className="grid min-w-64 grid-cols-2 gap-2 lg:grid-cols-1">
            <Button
              variant="primary"
              disabled={Boolean(busy)}
              onClick={() =>
                void mutate(
                  session.status === "paused" ? "resumption" : "pauses",
                  session.status === "paused" ? {} : { reason: null },
                )
              }
            >
              {session.status === "paused" ? (
                <Play aria-hidden="true" />
              ) : (
                <Pause aria-hidden="true" />
              )}
              {session.status === "paused" ? copy.resume : copy.pause}
            </Button>
            <Button
              variant="secondary"
              disabled={Boolean(busy)}
              onClick={() =>
                void mutate("extension", { additionalSeconds: 300 })
              }
            >
              <Plus aria-hidden="true" /> {copy.addFive}
            </Button>
            <Button
              variant="secondary"
              disabled={Boolean(busy)}
              onClick={() => setLogging(true)}
            >
              <TriangleAlert aria-hidden="true" /> {copy.interruption}
            </Button>
            {session.kind === "pomodoro" && interval?.kind !== "focus" && (
              <Button
                variant="ghost"
                disabled={Boolean(busy)}
                onClick={() => void mutate("intervals/advance", { skip: true })}
              >
                {copy.skipBreak}
              </Button>
            )}
            {session.kind === "pomodoro" &&
              ready &&
              interval?.kind === "focus" &&
              interval.cycleNumber < (session.pomodoroConfig?.cycles ?? 1) && (
                <Button
                  variant="primary"
                  disabled={Boolean(busy)}
                  onClick={() =>
                    void mutate("intervals/advance", { skip: false })
                  }
                >
                  {copy.nextInterval}
                </Button>
              )}
            <Button
              variant="ghost"
              disabled={Boolean(busy)}
              onClick={() => setReview("completion")}
            >
              <CheckCircle2 aria-hidden="true" /> {copy.complete}
            </Button>
            <Button
              variant="ghost"
              disabled={Boolean(busy)}
              onClick={() => setReview("abandonment")}
            >
              <CircleStop aria-hidden="true" /> {copy.abandon}
            </Button>
          </div>
        </div>

        {ready && (
          <div
            className="bg-primary/10 text-primary mt-6 rounded-xl px-4 py-3 text-sm font-medium"
            role="status"
          >
            {copy.timerReady}
          </div>
        )}
        <AutoAdvance
          enabled={Boolean(
            typeof navigator !== "undefined" &&
            navigator.onLine &&
            ready &&
            interval &&
            session.kind === "pomodoro" &&
            ((interval.kind === "focus" &&
              interval.cycleNumber < (session.pomodoroConfig?.cycles ?? 1) &&
              session.pomodoroConfig?.autoStartBreaks) ||
              (interval.kind !== "focus" &&
                session.pomodoroConfig?.autoStartFocus)),
          )}
          commandKey={`${interval?.id ?? "none"}:${session.version}`}
          onAdvance={() => void mutate("intervals/advance", { skip: false })}
        />
        <p className="text-muted-foreground mt-5 text-xs leading-5">
          {copy.noBackgroundPromise}
        </p>

        {logging && (
          <div className="border-border mt-6 border-t pt-6">
            <h3 className="font-semibold">{copy.interruptionTitle}</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as InterruptionCategory)
                }
                className={selectClass}
              >
                {Object.entries(copy.interruptionLabels).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
              <Input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                placeholder={copy.interruptionNote}
              />
              <Button
                disabled={Boolean(busy)}
                onClick={() =>
                  void mutate("interruptions", { category, note: note || null })
                }
              >
                {copy.record}
              </Button>
            </div>
          </div>
        )}
        {review && (
          <div className="border-border mt-6 border-t pt-6">
            <h3 className="font-semibold">{copy.outcomeTitle}</h3>
            <label
              className="mt-3 block text-sm font-medium"
              htmlFor="focus-outcome"
            >
              {copy.outcomeLabel}
            </label>
            <textarea
              id="focus-outcome"
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
              maxLength={2000}
              placeholder={copy.outcomePlaceholder}
              className="border-input bg-background focus-visible:ring-ring mt-2 min-h-28 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant={review === "completion" ? "primary" : "secondary"}
                disabled={Boolean(busy)}
                onClick={() =>
                  void mutate(review, { outcome: outcome || null }, true)
                }
              >
                {review === "completion"
                  ? copy.confirmComplete
                  : copy.confirmAbandon}
              </Button>
              <Button variant="ghost" onClick={() => setReview(null)}>
                {copy.cancel}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentSessions({
  sessions,
  copy,
  locale,
}: Readonly<{
  sessions: readonly FocusSessionView[];
  copy: FocusCopy;
  locale: Locale;
}>) {
  return (
    <section className="mt-8" aria-labelledby="recent-focus-title">
      <h2 id="recent-focus-title" className="text-xl font-semibold">
        {copy.recentTitle}
      </h2>
      {sessions.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-sm">{copy.recentEmpty}</p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {sessions.map((session) => (
            <Card key={session.id}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className="bg-primary/10 text-primary rounded-xl p-2">
                  <AlarmClock className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-medium">{session.intent}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {copy.focusedFor(
                      Math.max(1, Math.round(session.focusedSeconds / 60)),
                    )}{" "}
                    · {copy.interruptions(session.interruptionCount)}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(session.startedAt))}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function AutoAdvance({
  enabled,
  commandKey,
  onAdvance,
}: Readonly<{
  enabled: boolean;
  commandKey: string;
  onAdvance: () => void;
}>) {
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || sent.current === commandKey) return;
    sent.current = commandKey;
    onAdvance();
  }, [commandKey, enabled, onAdvance]);
  return null;
}

function LoadingState({ copy }: { readonly copy: FocusCopy }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12" role="status">
      <Card>
        <CardContent className="flex items-center gap-3 p-6">
          <RefreshCw
            className="text-primary size-5 animate-spin"
            aria-hidden="true"
          />
          <p>{copy.loading}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function SignedOutState({
  locale,
  copy,
}: {
  readonly locale: Locale;
  readonly copy: FocusCopy;
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>{copy.signInTitle}</CardTitle>
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

function StatusBanner({
  children,
  tone = "default",
  icon: Icon = Sparkles,
}: Readonly<{
  children: React.ReactNode;
  tone?: "default" | "error";
  icon?: typeof Sparkles;
}>) {
  return (
    <div
      className={cn(
        "mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm",
        tone === "error"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-primary/20 bg-primary/5",
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      <span className="flex items-center gap-2">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {children}
      </span>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: Readonly<{ label: string; error?: string; children: React.ReactNode }>) {
  return (
    <label className="block text-sm font-medium">
      <span className="mb-2 block">{label}</span>
      {children}
      {error && (
        <span className="text-destructive mt-1 block text-xs">{error}</span>
      )}
    </label>
  );
}

function MinuteField({
  name,
  label,
  register,
  max,
}: Readonly<{
  name: "focusMinutes" | "shortBreakMinutes" | "longBreakMinutes" | "cycles";
  label: string;
  register: ReturnType<typeof useForm<StartValues>>["register"];
  max: number;
}>) {
  return (
    <Field label={label}>
      <Input
        {...register(name, { valueAsNumber: true, min: 1, max })}
        type="number"
        min={1}
        max={max}
        inputMode="numeric"
      />
    </Field>
  );
}

function CheckField({
  label,
  input,
}: Readonly<{ label: string; input: React.ReactNode }>) {
  return (
    <label className="border-border flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3">
      {input}
      <span>{label}</span>
    </label>
  );
}

const selectClass =
  "border-input bg-background focus-visible:ring-ring min-h-10 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2";

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3_600);
  const minutes = Math.floor((safe % 3_600) / 60);
  const seconds = safe % 60;
  return hours > 0
    ? `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
    : `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function playTone() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.45);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.5);
    oscillator.addEventListener("ended", () => void context.close());
  } catch {
    // Sound is an optional enhancement; timer completion remains visible.
  }
}

async function flushOffline(accessToken: string) {
  for (const command of await pendingFocusCommands()) {
    try {
      await authFetch(
        `/api/v1/focus-sessions/${command.sessionId}/${command.action}`,
        {
          method: "POST",
          body: JSON.stringify({
            expectedVersion: command.expectedVersion,
            clientCommandId: command.clientCommandId,
            outcome: command.outcome,
          }),
        },
        accessToken,
      );
      await removeFocusCommand(command.clientCommandId);
    } catch (caught) {
      if (caught instanceof AuthApiError && [404, 409].includes(caught.status))
        await removeFocusCommand(command.clientCommandId);
      else break;
    }
  }
}

function cacheKey(userId: string) {
  return `focused:focus:${userId}`;
}
function readCache(userId: string): FocusOverview | null {
  try {
    const stored = JSON.parse(
      sessionStorage.getItem(cacheKey(userId)) ?? "null",
    ) as { readonly cachedAt?: unknown; readonly data?: unknown } | null;
    if (!stored) return null;
    const parsed = focusOverviewResponseSchema.safeParse({
      success: true,
      data: stored.data ?? stored,
    });
    if (!parsed.success) return null;
    const cachedAt =
      typeof stored.cachedAt === "number" ? stored.cachedAt : Date.now();
    const ageSeconds = Math.max(0, Math.floor((Date.now() - cachedAt) / 1_000));
    const active = parsed.data.data.active;
    const currentTime = new Date().toISOString();
    return {
      ...parsed.data.data,
      serverNow: currentTime,
      active:
        active?.status === "running" && active.activeInterval
          ? {
              ...active,
              serverNow: currentTime,
              activeInterval: {
                ...active.activeInterval,
                elapsedSeconds:
                  active.activeInterval.elapsedSeconds + ageSeconds,
                remainingSeconds: Math.max(
                  0,
                  active.activeInterval.remainingSeconds - ageSeconds,
                ),
                overtimeSeconds: Math.max(
                  0,
                  ageSeconds - active.activeInterval.remainingSeconds,
                ),
              },
            }
          : active
            ? { ...active, serverNow: currentTime }
            : null,
    };
  } catch {
    return null;
  }
}
function errorMessage(error: unknown, copy: FocusCopy) {
  return error instanceof AuthApiError ? error.message : copy.genericError;
}
