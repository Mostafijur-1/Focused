import { describe, expect, it } from "vitest";

import {
  registerTrackerDefinition,
  trackerDefinition,
} from "@/features/tracking/domain/tracker-definition";

describe("tracker definition seam", () => {
  it("registers one typed definition per tracker kind", () => {
    registerTrackerDefinition({
      kind: "reading_item",
      schemaVersion: 1,
      allowedEntryFields: ["quantity", "note"],
      validateMetadata: (value): value is Readonly<Record<string, unknown>> =>
        typeof value === "object" && value !== null,
    });
    expect(trackerDefinition("reading_item")?.schemaVersion).toBe(1);
    expect(() =>
      registerTrackerDefinition({
        kind: "reading_item",
        schemaVersion: 2,
        allowedEntryFields: [],
        validateMetadata: (value): value is Readonly<Record<string, unknown>> =>
          typeof value === "object" && value !== null,
      }),
    ).toThrow(/already registered/u);
  });
});
