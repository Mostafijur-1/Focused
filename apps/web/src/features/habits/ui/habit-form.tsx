"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays } from "lucide-react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  HabitSchedule,
  HabitSummary,
} from "@/features/habits/domain/habit-types";
import type { HabitCopy } from "@/features/habits/ui/habit-copy";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  title: z.string().trim().min(1).max(160),
  kind: z.enum(["boolean", "count", "duration", "avoidance"]),
  scheduleType: z.enum(["daily", "weekdays", "interval", "custom_dates"]),
  date: z.iso.date(),
  targetValue: z.string().max(24),
  unit: z.string().trim().max(40),
  intervalDays: z.number().int().min(2).max(30),
  weekdays: z.array(z.boolean()).length(7),
  customDates: z.string().max(1_600),
});

type FormValues = z.infer<typeof formSchema>;

export interface HabitFormPayload {
  readonly title: string;
  readonly kind: FormValues["kind"];
  readonly target: Readonly<{ value: number | null; unit: string | null }>;
  readonly schedule: HabitSchedule;
  readonly date: string;
}

interface HabitFormProps {
  readonly copy: HabitCopy;
  readonly today: string;
  readonly habit?: HabitSummary;
  readonly busy: boolean;
  onCancel(): void;
  onSubmit(payload: HabitFormPayload): Promise<void>;
}

export function HabitForm({
  copy,
  today,
  habit,
  busy,
  onCancel,
  onSubmit,
}: HabitFormProps) {
  const defaults = formDefaults(habit, today);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
  });
  const kind = useWatch({ control: form.control, name: "kind" });
  const scheduleType = useWatch({
    control: form.control,
    name: "scheduleType",
  });

  useEffect(() => form.reset(formDefaults(habit, today)), [form, habit, today]);

  const submit = form.handleSubmit(async (values) => {
    const schedule = scheduleFrom(values);
    if (!schedule) {
      form.setError("customDates", { message: copy.customDatesHint });
      return;
    }
    const targetRequired =
      values.kind === "count" || values.kind === "duration";
    const targetValue = targetRequired ? Number(values.targetValue) : null;
    if (
      targetRequired &&
      (!Number.isFinite(targetValue) ||
        targetValue! <= 0 ||
        !values.unit.trim())
    ) {
      form.setError("targetValue", { message: copy.target });
      return;
    }
    await onSubmit({
      title: values.title.trim(),
      kind: values.kind,
      target: {
        value: targetValue,
        unit: targetRequired ? values.unit.trim() : null,
      },
      schedule,
      date: values.date,
    });
  });

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Field label={copy.title} error={form.formState.errors.title?.message}>
        <Input
          autoFocus={!habit}
          autoComplete="off"
          placeholder={copy.titlePlaceholder}
          {...form.register("title")}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={copy.kind}>
          <Select {...form.register("kind")}>
            {Object.entries(copy.kinds).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={copy.schedule}>
          <Select {...form.register("scheduleType")}>
            {Object.entries(copy.schedules).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {(kind === "count" || kind === "duration") && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={copy.target}
            error={form.formState.errors.targetValue?.message}
          >
            <Input
              type="number"
              min="0.01"
              max="1000000"
              step="any"
              inputMode="decimal"
              {...form.register("targetValue")}
            />
          </Field>
          <Field label={copy.unit}>
            <Input autoComplete="off" {...form.register("unit")} />
          </Field>
        </div>
      )}

      {scheduleType === "weekdays" && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">{copy.weekdays}</legend>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {copy.dayNames.map((day, index) => (
              <label
                key={day}
                className="border-border has-checked:border-primary has-checked:bg-primary/8 flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  {...form.register(`weekdays.${index}`)}
                />
                {day}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {scheduleType === "interval" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={copy.intervalDays}>
            <Input
              type="number"
              min="2"
              max="30"
              {...form.register("intervalDays", { valueAsNumber: true })}
            />
          </Field>
          <Field label={copy.anchorDate}>
            <Input type="date" {...form.register("date")} />
          </Field>
        </div>
      )}
      {scheduleType === "custom_dates" && (
        <Field
          label={copy.customDates}
          hint={copy.customDatesHint}
          error={form.formState.errors.customDates?.message}
        >
          <textarea
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/20 min-h-24 w-full rounded-xl border p-3 outline-none focus-visible:ring-3"
            {...form.register("customDates")}
          />
        </Field>
      )}
      {scheduleType !== "interval" && (
        <Field label={habit ? copy.anchorDate : copy.startsOn}>
          <div className="relative">
            <CalendarDays
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-3.5 left-3 size-4"
            />
            <Input className="pl-10" type="date" {...form.register("date")} />
          </div>
        </Field>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {copy.cancel}
        </Button>
        <Button type="submit" disabled={busy}>
          {copy.save}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: Readonly<{
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: React.ReactNode;
}>) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {hint && (
        <span className="text-muted-foreground mt-1 block font-normal">
          {hint}
        </span>
      )}
      <span className="mt-2 block">{children}</span>
      {error && (
        <span role="alert" className="text-destructive mt-1 block text-xs">
          {error}
        </span>
      )}
    </label>
  );
}

function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/20 h-12 w-full rounded-xl border px-3 outline-none focus-visible:ring-3",
        className,
      )}
      {...props}
    />
  );
}

function formDefaults(
  habit: HabitSummary | undefined,
  today: string,
): FormValues {
  const schedule = habit?.scheduleVersion.schedule;
  return {
    title: habit?.title ?? "",
    kind: habit?.kind ?? "boolean",
    scheduleType: schedule?.type ?? "daily",
    date: habit ? today : today,
    targetValue: habit?.scheduleVersion.target.value?.toString() ?? "",
    unit: habit?.scheduleVersion.target.unit ?? "",
    intervalDays: schedule?.type === "interval" ? schedule.everyDays : 2,
    weekdays: Array.from({ length: 7 }, (_, index) =>
      schedule?.type === "weekdays"
        ? schedule.weekdays.includes(index)
        : index > 0 && index < 6,
    ),
    customDates:
      schedule?.type === "custom_dates" ? schedule.dates.join(", ") : "",
  };
}

function scheduleFrom(values: FormValues): HabitSchedule | null {
  if (values.scheduleType === "daily") return { type: "daily" };
  if (values.scheduleType === "weekdays") {
    const weekdays = values.weekdays.flatMap((checked, index) =>
      checked ? [index] : [],
    );
    return weekdays.length ? { type: "weekdays", weekdays } : null;
  }
  if (values.scheduleType === "interval")
    return {
      type: "interval",
      everyDays: values.intervalDays,
      anchorDate: values.date,
    };
  const dates = [
    ...new Set(
      values.customDates
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ].sort();
  return dates.length ? { type: "custom_dates", dates } : null;
}
