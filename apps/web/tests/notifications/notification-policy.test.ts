import { describe, expect, it } from "vitest";

import {
  isInQuietHours,
  isSafeDeepLink,
  localDateTimeToInstant,
  nextQuietHoursEnd,
  safePushCopy,
} from "@/features/notifications/domain/notification-policy";

describe("notification privacy and quiet-hours policy", () => {
  it("uses fixed privacy-safe Push copy instead of private reminder text", () => {
    expect(safePushCopy("bn-BD", "MINIMAL")).toEqual({
      title: "Focused Reminder",
      body: "পরবর্তী কাজটি দেখার সময় হয়েছে।",
    });
    expect(JSON.stringify(safePushCopy("en", "HIDDEN"))).not.toContain(
      "journal",
    );
  });

  it("accepts only local, locale-scoped deep links", () => {
    expect(isSafeDeepLink("/bn-BD/notifications")).toBe(true);
    expect(isSafeDeepLink("/en/focus")).toBe(true);
    expect(isSafeDeepLink("https://evil.example/steal")).toBe(false);
    expect(isSafeDeepLink("//evil.example")).toBe(false);
  });

  it("enforces overnight quiet hours in the configured time zone", () => {
    const quiet = {
      enabled: true,
      start: "22:00",
      end: "07:00",
      timeZone: "Asia/Dhaka",
    } as const;
    expect(isInQuietHours(new Date("2026-08-01T18:30:00.000Z"), quiet)).toBe(
      true,
    );
    expect(isInQuietHours(new Date("2026-08-01T08:00:00.000Z"), quiet)).toBe(
      false,
    );
    expect(
      nextQuietHoursEnd(new Date("2026-08-01T18:30:00.000Z"), quiet),
    ).toEqual(new Date("2026-08-02T01:00:00.000Z"));
  });

  it("resolves a DST gap forward rather than inventing an invalid instant", () => {
    const instant = localDateTimeToInstant(
      "2026-03-08",
      "02:30",
      "America/New_York",
    );
    expect(instant.toISOString()).toBe("2026-03-08T07:30:00.000Z");
  });
});
