import { describe, expect, it } from "vitest";

import {
  defaultLocale,
  getAlternateLocale,
  getMessages,
  isLocale,
  locales,
} from "@/i18n/config";
import { getSiteCopy } from "@/i18n/site-copy";

describe("locale configuration", () => {
  it("uses native Bangla as the default locale", () => {
    expect(defaultLocale).toBe("bn-BD");
    expect(locales).toEqual(["bn-BD", "en"]);
    expect(getMessages("bn-BD").meta.languageTag).toBe("bn-BD");
  });

  it.each([
    ["bn-BD", true],
    ["en", true],
    ["bn", false],
    ["EN", false],
    ["javascript:alert(1)", false],
  ] as const)("validates locale %s", (candidate, expected) => {
    expect(isLocale(candidate)).toBe(expected);
  });

  it("returns the other supported locale", () => {
    expect(getAlternateLocale("bn-BD")).toBe("en");
    expect(getAlternateLocale("en")).toBe("bn-BD");
  });

  it("keeps complete site copy in both languages", () => {
    const bangla = getSiteCopy("bn-BD");
    const english = getSiteCopy("en");

    expect(Object.keys(bangla)).toEqual(Object.keys(english));
    expect(bangla.title).toContain("মনোযোগ");
    expect(english.title).toContain("attention");
  });
});
