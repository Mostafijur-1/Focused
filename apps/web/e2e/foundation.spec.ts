import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("redirects the root route to the Bangla experience", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/bn-BD$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "bn-BD");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("মনোযোগ");
});

test("switches to the complete English locale", async ({ page }) => {
  await page.goto("/bn-BD");
  await page.getByRole("link", { name: "English" }).click();

  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Protect your attention",
  );
});

test("supports keyboard navigation and a persistent dark theme", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/bn-BD");
  await page.evaluate(() => localStorage.removeItem("theme"));
  await page.reload();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "মূল অংশে যান" })).toBeFocused();

  await expect(page.locator("html")).toHaveClass(/light/);
  await page.getByRole("button", { name: "গাঢ় থিম ব্যবহার করুন" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("has no automatically detectable critical accessibility violations", async ({
  page,
}) => {
  await page.goto("/bn-BD");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("exposes a no-store health endpoint with correlation", async ({
  request,
}) => {
  const response = await request.get("/api/v1/health", {
    headers: { "x-request-id": "e2e-trace-1234" },
  });
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["x-request-id"]).toBe("e2e-trace-1234");
  expect(response.headers()["cache-control"]).toBe("no-store");
  await expect(response.json()).resolves.toMatchObject({
    status: "ok",
    service: "focused-web",
  });
});
