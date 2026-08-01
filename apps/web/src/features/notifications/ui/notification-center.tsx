"use client";

import {
  AlarmClock,
  Archive,
  Bell,
  BellOff,
  Check,
  CirclePause,
  CloudOff,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  localDateAt,
  localDateTimeToInstant,
  localTimeAt,
} from "@/features/notifications/domain/notification-policy";
import type {
  NotificationCategory,
  NotificationOverview,
  ReminderSummary,
} from "@/features/notifications/domain/notification-types";
import {
  notificationOverviewResponseSchema,
  notificationResponseSchema,
  preferenceResponseSchema,
  pushSubscriptionResponseSchema,
  reminderResponseSchema,
} from "@/features/notifications/transport/notification-schemas";
import {
  getNotificationCopy,
  type NotificationCopy,
} from "@/features/notifications/ui/notification-copy";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

interface NotificationCenterProps {
  readonly locale: Locale;
}

type ScheduleKind = "once" | "daily" | "weekly";
interface ReminderFormValues {
  title: string;
  body: string;
  kind: ScheduleKind;
  date: string;
  time: string;
  interval: number;
  weekdays: number[];
  inApp: boolean;
  webPush: boolean;
}

const categories = [
  "reminder",
  "focus",
  "habit",
  "goal",
  "planning",
  "system",
] as const satisfies readonly NotificationCategory[];

export function NotificationCenter({ locale }: NotificationCenterProps) {
  const copy = getNotificationCopy(locale);
  const auth = useAuth();
  const [overview, setOverview] = useState<NotificationOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<ReminderSummary | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (auth.status !== "authenticated" || !auth.session) return;
    setLoading(true);
    setError(null);
    try {
      const response = notificationOverviewResponseSchema.parse(
        await authFetch<unknown>(
          "/api/v1/notifications/overview",
          {},
          auth.session.accessToken,
        ),
      );
      setOverview(response.data as NotificationOverview);
      setOffline(false);
      sessionStorage.setItem(
        cacheKey(auth.session.user.id),
        JSON.stringify(response.data),
      );
    } catch (caught) {
      const cached = readCache(auth.session.user.id);
      if (cached && !(caught instanceof AuthApiError)) {
        setOverview(cached);
        setOffline(true);
      } else {
        setError(messageFor(caught, copy));
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
    const online = () => void load();
    window.addEventListener("online", online);
    return () => {
      window.clearTimeout(task);
      window.removeEventListener("online", online);
    };
  }, [auth.status, load]);

  async function mutate(
    key: string,
    path: string,
    init: RequestInit,
    successNotice?: string,
  ) {
    if (!auth.session) return false;
    setBusy(key);
    setError(null);
    try {
      await authFetch(path, init, auth.session.accessToken);
      if (successNotice) setNotice(successNotice);
      await load();
      return true;
    } catch (caught) {
      if (caught instanceof AuthApiError && caught.status === 409) {
        setNotice(copy.changedElsewhere);
        await load();
      } else setError(messageFor(caught, copy));
      return false;
    } finally {
      setBusy(null);
    }
  }

  if (loading && !overview) return <LoadingState copy={copy} />;
  if (auth.status === "anonymous") {
    return (
      <CenteredState icon={BellOff} message={copy.signIn}>
        <Link
          href={`/${locale}/sign-in`}
          className={buttonVariants({ variant: "primary" })}
        >
          {copy.signInAction}
        </Link>
      </CenteredState>
    );
  }
  if (!overview) {
    return (
      <CenteredState icon={BellOff} message={error ?? copy.loadError}>
        <Button onClick={() => void load()}>{copy.refresh}</Button>
      </CenteredState>
    );
  }

  const activeReminders = overview.reminders.reminders.filter(
    (reminder) => reminder.status === "ACTIVE",
  ).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-primary-text text-sm font-semibold tracking-wide">
            {copy.eyebrow}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            {copy.title}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6 sm:text-base">
            {copy.subtitle}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw
            className={cn("size-4", loading && "animate-spin")}
            aria-hidden="true"
          />
          {copy.refresh}
        </Button>
      </header>

      <div aria-live="polite" className="space-y-2">
        {offline && <StatusBanner icon={CloudOff}>{copy.offline}</StatusBanner>}
        {error && <StatusBanner tone="error">{error}</StatusBanner>}
        {notice && <StatusBanner icon={Check}>{notice}</StatusBanner>}
      </div>

      <section
        className="grid gap-3 sm:grid-cols-3"
        aria-label="Notification summary"
      >
        <MetricCard
          label={copy.unread(overview.inbox.unreadCount)}
          value={overview.inbox.unreadCount}
        />
        <MetricCard label={copy.activeReminders} value={activeReminders} />
        <MetricCard
          label={copy.pushDevices}
          value={overview.push.subscriptions.length}
        />
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.8fr)]">
        <div className="space-y-6">
          <ReminderSection
            copy={copy}
            locale={locale}
            overview={overview}
            editing={editing}
            showForm={showForm}
            busy={busy}
            onAdd={() => {
              setEditing(null);
              setShowForm(true);
            }}
            onEdit={(reminder) => {
              setEditing(reminder);
              setShowForm(true);
            }}
            onCloseForm={() => {
              setShowForm(false);
              setEditing(null);
            }}
            onSave={async (body, reminder) => {
              if (!auth.session) return false;
              setBusy(reminder?.id ?? "create");
              setError(null);
              try {
                reminderResponseSchema.parse(
                  await authFetch<unknown>(
                    reminder
                      ? `/api/v1/reminders/${reminder.id}`
                      : "/api/v1/reminders",
                    {
                      method: reminder ? "PUT" : "POST",
                      body: JSON.stringify(body),
                    },
                    auth.session.accessToken,
                  ),
                );
                setNotice(copy.saved);
                setShowForm(false);
                setEditing(null);
                await load();
                return true;
              } catch (caught) {
                if (caught instanceof AuthApiError && caught.status === 409) {
                  setNotice(copy.changedElsewhere);
                  await load();
                } else setError(messageFor(caught, copy));
                return false;
              } finally {
                setBusy(null);
              }
            }}
            onState={(reminder, action) =>
              mutate(
                reminder.id,
                `/api/v1/reminders/${reminder.id}/state`,
                {
                  method: "POST",
                  body: JSON.stringify({
                    action,
                    expectedVersion: reminder.version,
                  }),
                },
                copy.saved,
              )
            }
            onOccurrence={(reminder, action) => {
              if (!reminder.nextOccurrence) return Promise.resolve(false);
              const snoozedUntil =
                action === "snooze"
                  ? new Date(Date.now() + 10 * 60_000).toISOString()
                  : null;
              return mutate(
                reminder.nextOccurrence.id,
                `/api/v1/reminder-occurrences/${reminder.nextOccurrence.id}/action`,
                {
                  method: "POST",
                  body: JSON.stringify({
                    action,
                    expectedVersion: reminder.nextOccurrence.version,
                    snoozedUntil,
                  }),
                },
                action === "snooze"
                  ? copy.snoozed
                  : action === "skip"
                    ? copy.skipped
                    : copy.occurrenceCompleted,
              );
            }}
            onDelete={(reminder) =>
              window.confirm(copy.deleteConfirm)
                ? mutate(
                    reminder.id,
                    `/api/v1/reminders/${reminder.id}?expectedVersion=${reminder.version}`,
                    { method: "DELETE" },
                    copy.saved,
                  )
                : Promise.resolve(false)
            }
          />
          <InboxSection
            copy={copy}
            locale={locale}
            overview={overview}
            busy={busy}
            onState={async (item, action) => {
              if (!auth.session) return;
              setBusy(item.id);
              try {
                notificationResponseSchema.parse(
                  await authFetch<unknown>(
                    `/api/v1/notifications/${item.id}`,
                    {
                      method: "PATCH",
                      body: JSON.stringify({
                        action,
                        expectedVersion: item.version,
                      }),
                    },
                    auth.session.accessToken,
                  ),
                );
                await load();
              } catch (caught) {
                setError(messageFor(caught, copy));
              } finally {
                setBusy(null);
              }
            }}
          />
        </div>

        <div className="space-y-6 xl:sticky xl:top-6">
          <PreferencesCard
            key={overview.preferences.version}
            copy={copy}
            value={overview.preferences}
            busy={busy === "preferences"}
            onSave={async (value) => {
              if (!auth.session) return;
              setBusy("preferences");
              try {
                preferenceResponseSchema.parse(
                  await authFetch<unknown>(
                    "/api/v1/notification-preferences",
                    { method: "PATCH", body: JSON.stringify(value) },
                    auth.session.accessToken,
                  ),
                );
                setNotice(copy.saved);
                await load();
              } catch (caught) {
                setError(messageFor(caught, copy));
              } finally {
                setBusy(null);
              }
            }}
          />
          <PushCard
            copy={copy}
            locale={locale}
            overview={overview}
            busy={busy}
            onEnable={async () => {
              if (!auth.session || !overview.push.publicKey) return;
              setBusy("push-enable");
              try {
                const permission =
                  await window.Notification.requestPermission();
                if (permission !== "granted") {
                  setError(copy.permissionDenied);
                  return;
                }
                const registration = await navigator.serviceWorker.register(
                  "/sw.js",
                  {
                    scope: "/",
                  },
                );
                const subscription = await registration.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: vapidKey(overview.push.publicKey),
                });
                const json = subscription.toJSON();
                if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
                  throw new Error("Push subscription is incomplete.");
                }
                pushSubscriptionResponseSchema.parse(
                  await authFetch<unknown>(
                    "/api/v1/push-subscriptions",
                    {
                      method: "POST",
                      body: JSON.stringify({
                        endpoint: json.endpoint,
                        expirationTime: json.expirationTime ?? null,
                        keys: json.keys,
                        deviceName: browserDeviceName(),
                        locale,
                      }),
                    },
                    auth.session.accessToken,
                  ),
                );
                setNotice(copy.pushEnabled);
                await load();
              } catch (caught) {
                setError(messageFor(caught, copy));
              } finally {
                setBusy(null);
              }
            }}
            onTest={() =>
              mutate(
                "push-test",
                "/api/v1/push-subscriptions/test",
                { method: "POST" },
                copy.testSent,
              )
            }
            onRevoke={async (id) => {
              const done = await mutate(
                id,
                `/api/v1/push-subscriptions/${id}`,
                { method: "DELETE" },
                copy.saved,
              );
              if (done && "serviceWorker" in navigator) {
                const registration =
                  await navigator.serviceWorker.getRegistration();
                const subscription =
                  await registration?.pushManager.getSubscription();
                await subscription?.unsubscribe();
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ReminderSection(props: {
  readonly copy: NotificationCopy;
  readonly locale: Locale;
  readonly overview: NotificationOverview;
  readonly editing: ReminderSummary | null;
  readonly showForm: boolean;
  readonly busy: string | null;
  readonly onAdd: () => void;
  readonly onEdit: (reminder: ReminderSummary) => void;
  readonly onCloseForm: () => void;
  readonly onSave: (
    body: unknown,
    reminder: ReminderSummary | null,
  ) => Promise<boolean>;
  readonly onState: (
    reminder: ReminderSummary,
    action: "pause" | "resume" | "complete",
  ) => Promise<boolean>;
  readonly onOccurrence: (
    reminder: ReminderSummary,
    action: "snooze" | "skip" | "complete",
  ) => Promise<boolean>;
  readonly onDelete: (reminder: ReminderSummary) => Promise<boolean>;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{props.copy.remindersTitle}</CardTitle>
          <CardDescription>{props.copy.remindersDescription}</CardDescription>
        </div>
        {!props.showForm && (
          <Button size="compact" onClick={props.onAdd}>
            <Plus className="size-4" aria-hidden="true" />
            {props.copy.addReminder}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {props.showForm && (
          <ReminderForm
            copy={props.copy}
            locale={props.locale}
            timeZone={props.overview.reminders.timeZone}
            reminder={props.editing}
            busy={props.busy === (props.editing?.id ?? "create")}
            onSave={props.onSave}
            onCancel={props.onCloseForm}
          />
        )}
        {props.overview.reminders.reminders.length === 0 ? (
          <EmptyState icon={AlarmClock}>{props.copy.remindersEmpty}</EmptyState>
        ) : (
          <ul className="divide-border divide-y">
            {props.overview.reminders.reminders.map((reminder) => (
              <li
                key={reminder.id}
                className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        reminder.status === "ACTIVE"
                          ? "bg-emerald-500"
                          : "bg-muted-foreground/40",
                      )}
                      aria-hidden="true"
                    />
                    <p className="truncate font-semibold">{reminder.title}</p>
                  </div>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {reminder.nextOccurrenceAt
                      ? `${props.copy.next}: ${formatDateTime(reminder.nextOccurrenceAt, props.locale)}`
                      : props.copy.noNext}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {reminder.status === "ACTIVE" && reminder.nextOccurrence && (
                    <>
                      <IconButton
                        label={props.copy.snoozeTenMinutes}
                        icon={AlarmClock}
                        disabled={props.busy === reminder.nextOccurrence.id}
                        onClick={() =>
                          void props.onOccurrence(reminder, "snooze")
                        }
                      />
                      <IconButton
                        label={props.copy.skipOccurrence}
                        icon={X}
                        disabled={props.busy === reminder.nextOccurrence.id}
                        onClick={() =>
                          void props.onOccurrence(reminder, "skip")
                        }
                      />
                      <IconButton
                        label={props.copy.completeOccurrence}
                        icon={Check}
                        disabled={props.busy === reminder.nextOccurrence.id}
                        onClick={() =>
                          void props.onOccurrence(reminder, "complete")
                        }
                      />
                    </>
                  )}
                  <IconButton
                    label={props.copy.edit}
                    icon={Pencil}
                    onClick={() => props.onEdit(reminder)}
                  />
                  {reminder.status === "ACTIVE" ? (
                    <IconButton
                      label={props.copy.pause}
                      icon={CirclePause}
                      disabled={props.busy === reminder.id}
                      onClick={() => void props.onState(reminder, "pause")}
                    />
                  ) : reminder.status === "PAUSED" ? (
                    <IconButton
                      label={props.copy.resume}
                      icon={RefreshCw}
                      disabled={props.busy === reminder.id}
                      onClick={() => void props.onState(reminder, "resume")}
                    />
                  ) : null}
                  <IconButton
                    label={props.copy.complete}
                    icon={Check}
                    disabled={
                      props.busy === reminder.id ||
                      reminder.status === "COMPLETED"
                    }
                    onClick={() => void props.onState(reminder, "complete")}
                  />
                  <IconButton
                    label={props.copy.delete}
                    icon={Trash2}
                    disabled={props.busy === reminder.id}
                    destructive
                    onClick={() => void props.onDelete(reminder)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ReminderForm(props: {
  readonly copy: NotificationCopy;
  readonly locale: Locale;
  readonly timeZone: string;
  readonly reminder: ReminderSummary | null;
  readonly busy: boolean;
  readonly onSave: (
    body: unknown,
    reminder: ReminderSummary | null,
  ) => Promise<boolean>;
  readonly onCancel: () => void;
}) {
  const defaults = useMemo(
    () => formDefaults(props.reminder, props.timeZone),
    [props.reminder, props.timeZone],
  );
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<ReminderFormValues>({ defaultValues: defaults });
  const kind = useWatch({ control, name: "kind" });
  const weekdays = useWatch({ control, name: "weekdays" });

  return (
    <form
      className="bg-muted/35 space-y-4 rounded-2xl border p-4"
      onSubmit={handleSubmit(async (values) => {
        const schedule =
          values.kind === "once"
            ? {
                kind: "once" as const,
                at: localDateTimeToInstant(
                  values.date,
                  values.time,
                  props.timeZone,
                ).toISOString(),
              }
            : values.kind === "daily"
              ? {
                  kind: "daily" as const,
                  startsOn: values.date,
                  localTime: values.time,
                  interval: Number(values.interval),
                }
              : {
                  kind: "weekly" as const,
                  startsOn: values.date,
                  localTime: values.time,
                  weekdays: values.weekdays,
                };
        await props.onSave(
          {
            title: values.title,
            body: values.body.trim() || null,
            timeZone: props.timeZone,
            schedule,
            channels: { inApp: values.inApp, webPush: values.webPush },
            ...(props.reminder
              ? { expectedVersion: props.reminder.version }
              : { clientCommandId: crypto.randomUUID() }),
          },
          props.reminder,
        );
      })}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          {props.reminder ? props.copy.editReminder : props.copy.addReminder}
        </h3>
        <button
          type="button"
          onClick={props.onCancel}
          className="text-muted-foreground hover:text-foreground rounded-lg p-1"
        >
          <X className="size-5" aria-hidden="true" />
          <span className="sr-only">{props.copy.cancel}</span>
        </button>
      </div>
      <Field
        label={props.copy.titleLabel}
        {...(errors.title?.message ? { error: errors.title.message } : {})}
      >
        <Input
          placeholder={props.copy.titlePlaceholder}
          aria-invalid={Boolean(errors.title)}
          {...register("title", { required: true, maxLength: 200 })}
        />
      </Field>
      <Field label={props.copy.noteLabel}>
        <textarea
          className="border-input bg-background focus-visible:ring-ring min-h-20 w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2"
          placeholder={props.copy.notePlaceholder}
          maxLength={500}
          {...register("body")}
        />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          {props.copy.frequency}
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {(["once", "daily", "weekly"] as const).map((value) => (
            <label
              key={value}
              className={cn(
                "cursor-pointer rounded-xl border px-3 py-2 text-center text-sm",
                kind === value && "border-primary bg-primary/8 text-primary",
              )}
            >
              <input
                type="radio"
                value={value}
                className="sr-only"
                {...register("kind")}
              />
              {props.copy[value]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={props.copy.date}>
          <Input type="date" {...register("date", { required: true })} />
        </Field>
        <Field label={props.copy.time}>
          <Input type="time" {...register("time", { required: true })} />
        </Field>
      </div>
      {kind === "daily" && (
        <Field label={props.copy.interval}>
          <Input
            type="number"
            min={1}
            max={30}
            {...register("interval", { valueAsNumber: true, min: 1, max: 30 })}
          />
        </Field>
      )}
      {kind === "weekly" && (
        <fieldset>
          <legend className="sr-only">{props.copy.weekly}</legend>
          <div className="flex flex-wrap gap-2">
            {props.copy.weekdays.map((day, index) => {
              const selected = weekdays.includes(index);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={selected}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm",
                    selected &&
                      "border-primary bg-primary text-primary-foreground",
                  )}
                  onClick={() =>
                    setValue(
                      "weekdays",
                      selected
                        ? weekdays.filter((value) => value !== index)
                        : [...weekdays, index].sort(),
                      { shouldValidate: true },
                    )
                  }
                >
                  {day}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          {props.copy.channels}
        </legend>
        <div className="flex flex-wrap gap-4">
          <CheckLabel
            label={props.copy.inApp}
            input={<input type="checkbox" {...register("inApp")} />}
          />
          <CheckLabel
            label={props.copy.webPush}
            input={<input type="checkbox" {...register("webPush")} />}
          />
        </div>
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={props.onCancel}>
          {props.copy.cancel}
        </Button>
        <Button
          type="submit"
          disabled={props.busy || (kind === "weekly" && weekdays.length === 0)}
        >
          {props.busy ? props.copy.saving : props.copy.save}
        </Button>
      </div>
    </form>
  );
}

function InboxSection(props: {
  readonly copy: NotificationCopy;
  readonly locale: Locale;
  readonly overview: NotificationOverview;
  readonly busy: string | null;
  readonly onState: (
    item: NotificationOverview["inbox"]["items"][number],
    action: "read" | "unread" | "archive",
  ) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.copy.inboxTitle}</CardTitle>
        <CardDescription>{props.copy.inboxDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        {props.overview.inbox.items.length === 0 ? (
          <EmptyState icon={Bell}>{props.copy.inboxEmpty}</EmptyState>
        ) : (
          <ul className="divide-border divide-y">
            {props.overview.inbox.items.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "py-4 first:pt-0",
                  !item.readAt && "border-l-primary border-l-2 pl-3",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {item.deepLink ? (
                      <Link
                        href={item.deepLink as Route}
                        className="font-semibold hover:underline"
                      >
                        {item.title}
                      </Link>
                    ) : (
                      <p className="font-semibold">{item.title}</p>
                    )}
                    {item.body && (
                      <p className="text-muted-foreground mt-1 text-sm leading-5">
                        {item.body}
                      </p>
                    )}
                    <time
                      className="text-muted-foreground mt-2 block text-xs"
                      dateTime={item.createdAt}
                    >
                      {formatDateTime(item.createdAt, props.locale)}
                    </time>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <IconButton
                      label={
                        item.readAt
                          ? props.copy.markUnread
                          : props.copy.markRead
                      }
                      icon={Check}
                      disabled={props.busy === item.id}
                      onClick={() =>
                        void props.onState(
                          item,
                          item.readAt ? "unread" : "read",
                        )
                      }
                    />
                    <IconButton
                      label={props.copy.archive}
                      icon={Archive}
                      disabled={props.busy === item.id}
                      onClick={() => void props.onState(item, "archive")}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PreferencesCard(props: {
  readonly copy: NotificationCopy;
  readonly value: NotificationOverview["preferences"];
  readonly busy: boolean;
  readonly onSave: (value: unknown) => Promise<void>;
}) {
  const [value, setValue] = useState(props.value);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.copy.preferencesTitle}</CardTitle>
        <CardDescription>{props.copy.preferencesDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          {categories.map((category) => (
            <div
              key={category}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-sm"
            >
              <span>{props.copy.categories[category]}</span>
              <CheckLabel
                label={props.copy.inApp}
                compact
                input={
                  <input
                    type="checkbox"
                    checked={value.categories[category].inApp}
                    onChange={(event) =>
                      setValue({
                        ...value,
                        categories: {
                          ...value.categories,
                          [category]: {
                            ...value.categories[category],
                            inApp: event.target.checked,
                          },
                        },
                      })
                    }
                  />
                }
              />
              <CheckLabel
                label={props.copy.webPush}
                compact
                input={
                  <input
                    type="checkbox"
                    checked={value.categories[category].webPush}
                    onChange={(event) =>
                      setValue({
                        ...value,
                        categories: {
                          ...value.categories,
                          [category]: {
                            ...value.categories[category],
                            webPush: event.target.checked,
                          },
                        },
                      })
                    }
                  />
                }
              />
            </div>
          ))}
        </div>
        <div className="border-border space-y-3 border-t pt-4">
          <CheckLabel
            label={props.copy.quietHours}
            input={
              <input
                type="checkbox"
                checked={value.quietHours.enabled}
                onChange={(event) =>
                  setValue({
                    ...value,
                    quietHours: {
                      ...value.quietHours,
                      enabled: event.target.checked,
                    },
                  })
                }
              />
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label={props.copy.quietStart}>
              <Input
                type="time"
                value={value.quietHours.start}
                onChange={(event) =>
                  setValue({
                    ...value,
                    quietHours: {
                      ...value.quietHours,
                      start: event.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label={props.copy.quietEnd}>
              <Input
                type="time"
                value={value.quietHours.end}
                onChange={(event) =>
                  setValue({
                    ...value,
                    quietHours: {
                      ...value.quietHours,
                      end: event.target.value,
                    },
                  })
                }
              />
            </Field>
          </div>
        </div>
        <Field label={props.copy.preview}>
          <select
            className="border-input bg-background h-10 w-full rounded-xl border px-3 text-sm"
            value={value.previewPolicy}
            onChange={(event) =>
              setValue({
                ...value,
                previewPolicy: event.target.value as "MINIMAL" | "HIDDEN",
              })
            }
          >
            <option value="MINIMAL">{props.copy.minimal}</option>
            <option value="HIDDEN">{props.copy.hidden}</option>
          </select>
        </Field>
        <Button
          className="w-full"
          disabled={props.busy}
          onClick={() =>
            void props.onSave({
              categories: value.categories,
              quietHours: value.quietHours,
              previewPolicy: value.previewPolicy,
              expectedVersion: value.version,
            })
          }
        >
          {props.busy ? props.copy.saving : props.copy.savePreferences}
        </Button>
      </CardContent>
    </Card>
  );
}

function PushCard(props: {
  readonly copy: NotificationCopy;
  readonly locale: Locale;
  readonly overview: NotificationOverview;
  readonly busy: string | null;
  readonly onEnable: () => Promise<void>;
  readonly onTest: () => Promise<boolean>;
  readonly onRevoke: (id: string) => Promise<void>;
}) {
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.copy.pushTitle}</CardTitle>
        <CardDescription>{props.copy.pushDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!supported ? (
          <StatusBanner icon={BellOff}>
            {props.copy.pushUnsupported}
          </StatusBanner>
        ) : !props.overview.push.configured ? (
          <StatusBanner icon={BellOff}>
            {props.copy.pushNotConfigured}
          </StatusBanner>
        ) : (
          <Button
            className="w-full"
            variant="outline"
            disabled={props.busy === "push-enable"}
            onClick={() => void props.onEnable()}
          >
            <Bell className="size-4" aria-hidden="true" />
            {props.busy === "push-enable"
              ? props.copy.enablingPush
              : props.copy.enablePush}
          </Button>
        )}
        {props.overview.push.subscriptions.map((subscription) => (
          <div
            key={subscription.id}
            className="bg-muted/40 flex items-center justify-between gap-3 rounded-xl border p-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Smartphone
                className="text-primary size-5 shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {subscription.deviceName ?? props.copy.device}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatDateTime(subscription.createdAt, props.locale)}
                </p>
              </div>
            </div>
            <IconButton
              label={props.copy.revoke}
              icon={Trash2}
              destructive
              disabled={props.busy === subscription.id}
              onClick={() => void props.onRevoke(subscription.id)}
            />
          </div>
        ))}
        {props.overview.push.subscriptions.length > 0 && (
          <Button
            className="w-full"
            disabled={props.busy === "push-test"}
            onClick={() => void props.onTest()}
          >
            <Send className="size-4" aria-hidden="true" />
            {props.copy.testPush}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}) {
  return (
    <Card className="bg-card/70">
      <CardContent className="flex items-center justify-between p-4">
        <span className="text-muted-foreground text-sm">{label}</span>
        <strong className="text-2xl tabular-nums">{value}</strong>
      </CardContent>
    </Card>
  );
}

function IconButton(props: {
  readonly label: string;
  readonly icon: typeof Bell;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly destructive?: boolean;
}) {
  const Icon = props.icon;
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className={cn(
        "text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg p-2 transition-colors disabled:opacity-40",
        props.destructive && "hover:bg-destructive/10 hover:text-destructive",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

function Field(props: {
  readonly label: string;
  readonly children: React.ReactNode;
  readonly error?: string;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium">
      <span>{props.label}</span>
      {props.children}
      {props.error && (
        <span className="text-destructive text-xs">{props.error}</span>
      )}
    </label>
  );
}

function CheckLabel(props: {
  readonly label: string;
  readonly input: React.ReactNode;
  readonly compact?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-2 text-sm",
        props.compact && "flex-col gap-1 text-xs",
      )}
    >
      {props.input}
      <span>{props.label}</span>
    </label>
  );
}

function StatusBanner(props: {
  readonly children: React.ReactNode;
  readonly icon?: typeof Bell;
  readonly tone?: "normal" | "error";
}) {
  const Icon = props.icon;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
        props.tone === "error"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-primary/20 bg-primary/5",
      )}
    >
      {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
      {props.children}
    </div>
  );
}

function EmptyState(props: {
  readonly icon: typeof Bell;
  readonly children: React.ReactNode;
}) {
  const Icon = props.icon;
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-10 text-center text-sm">
      <Icon className="size-7" aria-hidden="true" />
      <p className="max-w-sm">{props.children}</p>
    </div>
  );
}

function CenteredState(props: {
  readonly icon: typeof Bell;
  readonly message: string;
  readonly children: React.ReactNode;
}) {
  const Icon = props.icon;
  return (
    <div className="flex min-h-[70svh] items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <Icon className="text-primary size-10" aria-hidden="true" />
          <p>{props.message}</p>
          {props.children}
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingState({ copy }: { readonly copy: NotificationCopy }) {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-8" role="status">
      <p className="sr-only">{copy.loading}</p>
      <div className="bg-muted h-10 w-72 animate-pulse rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <div key={key} className="bg-muted h-20 animate-pulse rounded-2xl" />
        ))}
      </div>
      <div className="bg-muted h-96 animate-pulse rounded-2xl" />
    </div>
  );
}

function formDefaults(
  reminder: ReminderSummary | null,
  timeZone: string,
): ReminderFormValues {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86_400_000);
  if (!reminder) {
    return {
      title: "",
      body: "",
      kind: "once",
      date: localDateAt(tomorrow, timeZone),
      time: "09:00",
      interval: 1,
      weekdays: [tomorrow.getDay()],
      inApp: true,
      webPush: false,
    };
  }
  const schedule = reminder.schedule;
  return {
    title: reminder.title,
    body: reminder.body ?? "",
    kind: schedule.kind,
    date:
      schedule.kind === "once"
        ? localDateAt(new Date(schedule.at), reminder.timeZone)
        : schedule.startsOn,
    time:
      schedule.kind === "once"
        ? localTimeAt(new Date(schedule.at), reminder.timeZone)
        : schedule.localTime,
    interval: schedule.kind === "daily" ? schedule.interval : 1,
    weekdays:
      schedule.kind === "weekly" ? [...schedule.weekdays] : [now.getDay()],
    inApp: reminder.channels.inApp,
    webPush: reminder.channels.webPush,
  };
}

function formatDateTime(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function vapidKey(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1)
    bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function browserDeviceName(): string {
  const platform = navigator.platform;
  return platform ? `${platform} Browser` : "Browser";
}

function cacheKey(userId: string) {
  return `focused:notifications:v1:${userId}`;
}

function readCache(userId: string): NotificationOverview | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = notificationOverviewResponseSchema.safeParse({
      data: JSON.parse(raw),
    });
    return parsed.success ? (parsed.data.data as NotificationOverview) : null;
  } catch {
    return null;
  }
}

function messageFor(error: unknown, copy: NotificationCopy): string {
  if (error instanceof AuthApiError) return error.message || copy.loadError;
  return error instanceof Error && error.message
    ? error.message
    : copy.loadError;
}
