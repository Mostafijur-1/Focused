import { bnBD, en, type FocusedMessages } from "@focused/design-system";

export const locales = ["bn-BD", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "bn-BD";

const dictionaries: Readonly<Record<Locale, FocusedMessages>> = {
  "bn-BD": bnBD,
  en,
};

export function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale === value);
}

export function getMessages(locale: Locale): FocusedMessages {
  return dictionaries[locale];
}

export function getAlternateLocale(locale: Locale): Locale {
  return locale === "bn-BD" ? "en" : "bn-BD";
}
