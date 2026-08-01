import { expect, test } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  expectNoWcagViolations,
} from "./support/accessibility";

test("redirects the root route to the Bangla experience", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/bn-BD$/u);
  await expect(page.locator("html")).toHaveAttribute("lang", "bn-BD");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("মনোযোগ");
});

test("switches to the complete English locale", async ({ page }) => {
  await page.goto("/bn-BD");
  await page.getByRole("link", { name: "English" }).click();

  await expect(page).toHaveURL(/\/en$/u);
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

  await expect(page.locator("html")).toHaveClass(/light/u);
  await page.getByRole("button", { name: /থিম ব্যবহার করুন$/u }).click();
  await expect(page.locator("html")).toHaveClass(/dark/u);

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/u);
});

test("has no automatically detectable critical accessibility violations", async ({
  page,
}) => {
  await page.goto("/bn-BD");
  await expectNoWcagViolations(page);
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

test("uses one accessible Google-only Authentication flow on mobile and desktop", async ({
  page,
}) => {
  let requestBody: Record<string, unknown> | undefined;
  await page.route("**/api/v1/auth/oauth/google/start", async (route) => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    const origin = new URL(route.request().url()).origin;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authorizationUrl: `${origin}/bn-BD?oauth=started`,
        expiresAt: "2026-08-01T12:05:00.000Z",
      }),
    });
  });

  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/bn-BD/sign-up");
  await expect(
    page.getByRole("heading", { name: "আপনার FocusOS শুরু করুন" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Google দিয়ে চালিয়ে যান" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByLabel(/Password/iu)).toHaveCount(0);
  await expectNoWcagViolations(page);
  await expectNoHorizontalOverflow(page, [320, 390, 768]);

  await page.getByRole("button", { name: "Google দিয়ে চালিয়ে যান" }).click();
  await expect(page).toHaveURL(/oauth=started/u);
  expect(requestBody).toMatchObject({
    locale: "bn-BD",
    returnTo: "/bn-BD/auth-complete",
  });
  expect(requestBody?.timeZone).toEqual(expect.any(String));
});
