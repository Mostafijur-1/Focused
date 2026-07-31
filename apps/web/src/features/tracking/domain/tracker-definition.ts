export const trackerKinds = [
  "learning_path",
  "learning_item",
  "programming_skill",
  "programming_project",
  "coding_problem",
  "reading_item",
  "quran_plan",
  "quran_review",
  "prayer",
  "workout_plan",
  "workout_exercise",
  "sleep",
  "mood",
  "body_metric",
  "custom",
] as const;

export type TrackerKind = (typeof trackerKinds)[number];

export interface TrackerDefinition<
  TMetadata extends Readonly<Record<string, unknown>>,
> {
  readonly kind: TrackerKind;
  readonly schemaVersion: number;
  readonly allowedEntryFields: readonly (
    "durationSeconds" | "quantity" | "rating" | "note" | "data"
  )[];
  validateMetadata(value: unknown): value is TMetadata;
}

const definitions = new Map<
  TrackerKind,
  TrackerDefinition<Readonly<Record<string, unknown>>>
>();

export function registerTrackerDefinition<
  TMetadata extends Readonly<Record<string, unknown>>,
>(definition: TrackerDefinition<TMetadata>): void {
  if (definition.schemaVersion < 1 || definitions.has(definition.kind)) {
    throw new Error(
      `Tracker definition is invalid or already registered: ${definition.kind}`,
    );
  }
  definitions.set(
    definition.kind,
    definition as TrackerDefinition<Readonly<Record<string, unknown>>>,
  );
}

export function trackerDefinition(kind: TrackerKind) {
  return definitions.get(kind) ?? null;
}
