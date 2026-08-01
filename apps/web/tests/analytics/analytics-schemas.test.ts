import { describe, expect, it } from "vitest";

import {
  analyticsQuerySchema,
  createExportSchema,
  updateGamificationSchema,
} from "@/features/analytics/transport/analytics-schemas";

describe("analytics transport schemas", () => {
  it("accepts an empty query and strict ISO date filters", () => {
    expect(analyticsQuerySchema.parse({})).toEqual({});
    expect(
      analyticsQuerySchema.parse({ start: "2026-07-01", end: "2026-07-31" }),
    ).toEqual({ start: "2026-07-01", end: "2026-07-31" });
    expect(() => analyticsQuerySchema.parse({ start: "07/01/2026" })).toThrow();
  });

  it("allows only privacy-filtered export formats", () => {
    expect(
      createExportSchema.parse({
        range: { start: "2026-07-01", end: "2026-07-31" },
        format: "csv",
        clientCommandId: "7f23c7a1-63ca-4c3f-9dfc-22bedae6bb50",
      }).format,
    ).toBe("csv");
    expect(() =>
      createExportSchema.parse({
        range: { start: "2026-07-01", end: "2026-07-31" },
        format: "pdf",
        clientCommandId: "7f23c7a1-63ca-4c3f-9dfc-22bedae6bb50",
      }),
    ).toThrow();
  });

  it("requires optimistic concurrency for preferences", () => {
    expect(
      updateGamificationSchema.parse({ enabled: false, expectedVersion: 1 }),
    ).toEqual({
      enabled: false,
      expectedVersion: 1,
    });
    expect(() =>
      updateGamificationSchema.parse({ enabled: false, expectedVersion: 0 }),
    ).toThrow();
  });
});
