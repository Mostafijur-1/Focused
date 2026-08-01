-- Permit a zero-length pause when two authoritative commands share a database timestamp.

BEGIN;

ALTER TABLE "session_pauses"
  DROP CONSTRAINT "session_pauses_time_range_check",
  ADD CONSTRAINT "session_pauses_time_range_check"
    CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt");

COMMIT;
