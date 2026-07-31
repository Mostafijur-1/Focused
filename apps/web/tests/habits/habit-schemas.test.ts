import { describe, expect, it } from "vitest";

import {
  checkInHabitSchema,
  createHabitSchema,
  pauseHabitSchema,
  updateHabitSchema,
} from "@/features/habits/transport/habit-schemas";
import { offlineHabitCommandSchema } from "@/features/habits/ui/habit-offline-queue";

const commandId = "151fcb66-d5cc-4cc9-9bbc-d6e9e89314d1";

describe("habit transport contracts", () => {
  it("accepts a bounded native habit command", () => {
    expect(
      createHabitSchema.safeParse({
        title: "২০ মিনিট পড়া",
        kind: "duration",
        target: { value: 20, unit: "minutes" },
        schedule: { type: "weekdays", weekdays: [0, 2, 4] },
        startsOn: "2026-08-01",
        clientCommandId: commandId,
      }).success,
    ).toBe(true);
  });

  it("rejects unknown properties and incomplete check-ins", () => {
    expect(
      createHabitSchema.safeParse({
        title: "Read",
        kind: "boolean",
        target: { value: null, unit: null },
        schedule: { type: "daily" },
        startsOn: "2026-08-01",
        clientCommandId: commandId,
        userId: commandId,
      }).success,
    ).toBe(false);
    expect(
      checkInHabitSchema.safeParse({
        localDate: "2026-08-01",
        value: null,
        completed: null,
        skippedReason: null,
        note: null,
        evidenceRef: null,
        clientCommandId: commandId,
      }).success,
    ).toBe(false);
  });

  it("requires optimistic versions and bounds pause reasons", () => {
    expect(
      updateHabitSchema.safeParse({
        title: "Read",
        kind: "boolean",
        target: { value: null, unit: null },
        schedule: { type: "daily" },
        effectiveOn: "2026-08-01",
        expectedVersion: 0,
      }).success,
    ).toBe(false);
    expect(
      pauseHabitSchema.safeParse({
        expectedVersion: 1,
        reason: "x".repeat(161),
      }).success,
    ).toBe(false);
    expect(pauseHabitSchema.parse({ expectedVersion: 1 })).toEqual({
      expectedVersion: 1,
      reason: null,
    });
  });

  it("keeps private text and credentials out of the Offline command queue", () => {
    const safe = {
      clientCommandId: commandId,
      habitId: "10d99be0-93c4-4454-a67b-6bbf06919442",
      localDate: "2026-08-01",
      value: null,
      completed: true,
    };
    expect(offlineHabitCommandSchema.safeParse(safe).success).toBe(true);
    expect(
      offlineHabitCommandSchema.safeParse({
        ...safe,
        title: "private",
        note: "private",
        accessToken: "secret",
      }).success,
    ).toBe(false);
  });
});
