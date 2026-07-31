import { mkdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

if (!process.env.SHADOW_DATABASE_URL) {
  throw new Error(
    "SHADOW_DATABASE_URL is required for migration drift checks.",
  );
}

await mkdir(".qa", { recursive: true });
const outputPath = ".qa/schema-drift.sql";
const command = process.platform === "win32" ? "corepack.cmd" : "corepack";
const result = spawnSync(
  command,
  [
    "pnpm",
    "exec",
    "prisma",
    "migrate",
    "diff",
    "--from-migrations",
    "prisma/migrations",
    "--to-schema",
    "prisma/schema.prisma",
    "--script",
    "--output",
    outputPath,
  ],
  { encoding: "utf8", stdio: "inherit" },
);

if (result.status !== 0) {
  throw new Error(
    `Prisma migration diff failed with exit code ${result.status}.`,
  );
}

const sql = await readFile(outputPath, "utf8");
const statements = sql
  .replaceAll(/--.*$/gm, "")
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean);

const nativeObjectNames = new Set([
  "calendar_events_time_range_check",
  "focus_sessions_planned_seconds_check",
  "focus_sessions_terminal_time_check",
  "session_pauses_time_range_check",
  "challenges_time_range_check",
  "delivery_attempts_attempt_check",
  "idempotency_records_expiry_check",
  "idempotency_records_completion_check",
  "webhook_inbox_attempts_check",
  "webhook_inbox_schema_version_check",
  "webhook_inbox_payload_size_check",
  "webhook_inbox_processed_check",
  "outbox_events_versions_check",
  "outbox_events_attempts_check",
  "outbox_events_payload_size_check",
  "outbox_events_terminal_state_check",
  "background_jobs_attempts_check",
  "background_jobs_schema_version_check",
  "background_jobs_payload_size_check",
  "metric_definitions_version_check",
  "metric_definitions_retirement_check",
  "focus_sessions_one_active_per_user_idx",
  "reminder_occurrences_due_idx",
  "outbox_events_ready_idx",
  "webhook_inbox_ready_idx",
  "background_jobs_ready_idx",
]);

const unexpected = statements.filter((statement) => {
  const normalized = statement.replaceAll(/\s+/g, " ").trim();
  const droppedIndex = normalized.match(/^DROP INDEX "([^"]+)"$/);
  if (droppedIndex) return !nativeObjectNames.has(droppedIndex[1]);

  const droppedConstraint = normalized.match(
    /^ALTER TABLE "[^"]+" DROP CONSTRAINT "([^"]+)"$/,
  );
  if (droppedConstraint) return !nativeObjectNames.has(droppedConstraint[1]);

  return true;
});

if (unexpected.length > 0) {
  throw new Error(`Unexpected Prisma schema drift:\n${unexpected.join(";\n")}`);
}

console.log(
  statements.length === 0
    ? "No Prisma schema drift detected."
    : `Only ${statements.length} allow-listed native PostgreSQL objects differ.`,
);
