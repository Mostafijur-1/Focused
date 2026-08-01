/** @vitest-environment node */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const tokens = readFileSync(
  resolve(process.cwd(), "../../design-system/tokens.css"),
  "utf8",
);
const themeSelectors = [":root", ".dark"] as const;

describe("Focused color tokens", () => {
  it.each(themeSelectors)(
    "keeps primary actions WCAG AA compliant in %s",
    (selector) => {
      const theme = themeTokens(selector);

      expect(
        contrast(theme.primary, theme.primaryForeground),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(theme.primaryText, theme.background),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("keeps selected light-theme controls readable on a 10% primary tint", () => {
    const theme = themeTokens(":root");
    const selectedBackground = composite(theme.primary, theme.background, 0.1);

    expect(contrast(theme.primary, selectedBackground)).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});

interface ThemeColors {
  readonly background: Rgb;
  readonly primary: Rgb;
  readonly primaryForeground: Rgb;
  readonly primaryText: Rgb;
}

type Rgb = readonly [red: number, green: number, blue: number];

function themeTokens(selector: ":root" | ".dark"): ThemeColors {
  const block = cssBlock(selector);
  return {
    background: color(block, "background"),
    primary: color(block, "primary"),
    primaryForeground: color(block, "primary-foreground"),
    primaryText: color(block, "primary-text"),
  };
}

function cssBlock(selector: string): string {
  const start = tokens.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Missing ${selector} token block.`);
  const bodyStart = tokens.indexOf("{", start) + 1;
  let depth = 1;
  for (let index = bodyStart; index < tokens.length; index += 1) {
    if (tokens[index] === "{") depth += 1;
    if (tokens[index] === "}") depth -= 1;
    if (depth === 0) return tokens.slice(bodyStart, index);
  }
  throw new Error(`Unclosed ${selector} token block.`);
}

function color(block: string, name: string): Rgb {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, "iu").exec(block);
  if (!match?.[1]) throw new Error(`Missing hexadecimal --${name} token.`);
  const hex = match[1];
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function contrast(first: Rgb, second: Rgb): number {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(rgb: Rgb): number {
  const [red, green, blue] = rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return red! * 0.2126 + green! * 0.7152 + blue! * 0.0722;
}

function composite(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return foreground.map((channel, index) =>
    Math.round(channel * alpha + background[index]! * (1 - alpha)),
  ) as unknown as Rgb;
}
