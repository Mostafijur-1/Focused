import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

const wcagTags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

export async function expectNoWcagViolations(
  page: Page,
  include?: string,
): Promise<void> {
  let audit = new AxeBuilder({ page }).withTags(wcagTags);
  if (include) audit = audit.include(include);
  const result = await audit.analyze();
  expect(result.violations).toEqual([]);
}

export async function expectNoHorizontalOverflow(
  page: Page,
  widths: readonly number[] = [320, 768, 1280],
): Promise<void> {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator("body")).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
}
