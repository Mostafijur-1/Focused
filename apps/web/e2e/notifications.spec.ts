import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const userId = "34d9a956-bf9a-4b23-92b4-b03396d39527";
const reminderId = "ae7eac88-7709-49f8-a2e2-203ef8ab5db8";
const occurrenceId = "ddb71958-a6d8-42e1-ab4e-51ce85c25730";

const reminder = {
  id: reminderId,
  title: "Start the main task",
  body: null,
  status: "ACTIVE",
  timeZone: "Asia/Dhaka",
  schedule: {
    kind: "daily",
    startsOn: "2026-08-02",
    localTime: "09:00",
    interval: 1,
  },
  channels: { inApp: true, webPush: false },
  nextOccurrenceAt: "2026-08-02T03:00:00.000Z",
  nextOccurrence: {
    id: occurrenceId,
    scheduledFor: "2026-08-02T03:00:00.000Z",
    version: 1,
  },
  lastOutcome: null,
  ruleVersion: 1,
  version: 1,
  createdAt: "2026-08-01T12:00:00.000Z",
};

test.beforeEach(async ({ page }) => {
  await page.context().addCookies([
    {
      name: "focused_csrf",
      value: "notifications-e2e-csrf",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "notifications-e2e-access",
        expiresIn: 600,
        sessionId: "a6e4dd5a-6417-40bf-860e-ec8eed9e440a",
        user: {
          id: userId,
          displayName: "Reminder Owner",
          permissions: [
            "notifications:read:own",
            "notifications:write:own",
            "notifications:push:own",
            "reminders:read:own",
            "reminders:write:own",
          ],
        },
      }),
    }),
  );
  await mockOverview(page);
});

test("renders an accessible and responsive notification workspace", async ({
  page,
}) => {
  await page.goto("/en/notifications");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Notifications and Reminders",
    }),
  ).toBeVisible();
  await expect(page.getByText(reminder.title)).toBeVisible();
  await expect(page.getByText("Web Push is not configured")).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);

  for (const width of [320, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
});

test("creates an idempotent reminder with explicit channels", async ({
  page,
}) => {
  let requestBody: Record<string, unknown> | undefined;
  await page.route("**/api/v1/reminders", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        data: { ...reminder, title: requestBody.title, version: 1 },
      }),
    });
  });

  await page.goto("/en/notifications");
  await page.getByRole("button", { name: "Add reminder" }).click();
  await page
    .getByLabel("What should we remind you about?")
    .fill("Review today's plan");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect
    .poll(() => requestBody)
    .toMatchObject({
      title: "Review today's plan",
      timeZone: "Asia/Dhaka",
      channels: { inApp: true, webPush: false },
    });
  expect(requestBody?.clientCommandId).toMatch(/^[0-9a-f-]{36}$/u);
});

test("snoozes only the selected occurrence with optimistic concurrency", async ({
  page,
}) => {
  let requestBody: Record<string, unknown> | undefined;
  await page.route(
    `**/api/v1/reminder-occurrences/${occurrenceId}/action`,
    async (route) => {
      requestBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { status: "DEFERRED" } }),
      });
    },
  );

  await page.goto("/en/notifications");
  await page.getByRole("button", { name: "Remind me in 10 minutes" }).click();

  await expect
    .poll(() => requestBody)
    .toMatchObject({
      action: "snooze",
      expectedVersion: 1,
    });
  expect(Date.parse(String(requestBody?.snoozedUntil))).not.toBeNaN();
});

test("exposes every implemented workspace from the mobile feature menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/notifications");
  await page.getByRole("button", { name: "More", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "All features" });
  await expect(dialog).toBeVisible();
  const destinations = {
    Dashboard: "/en/dashboard",
    Focus: "/en/focus",
    "AI Coach": "/en/coach",
    Habits: "/en/habits",
    Goals: "/en/goals",
    Week: "/en/week",
    Notifications: "/en/notifications",
    Security: "/en/security",
  } as const;
  for (const [label, href] of Object.entries(destinations)) {
    await expect(
      dialog.getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("href", href);
  }
  expect(
    (
      await new AxeBuilder({ page })
        .include("#mobile-feature-menu")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

async function mockOverview(page: Page) {
  await page.route("**/api/v1/notifications/overview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          inbox: { items: [], nextCursor: null, unreadCount: 0 },
          preferences: {
            categories: Object.fromEntries(
              ["reminder", "focus", "habit", "goal", "planning", "system"].map(
                (category) => [
                  category,
                  { inApp: true, webPush: category === "reminder" },
                ],
              ),
            ),
            quietHours: {
              enabled: true,
              start: "22:00",
              end: "07:00",
              timeZone: "Asia/Dhaka",
            },
            previewPolicy: "MINIMAL",
            version: 1,
            updatedAt: null,
          },
          reminders: { reminders: [reminder], timeZone: "Asia/Dhaka" },
          push: { configured: false, publicKey: null, subscriptions: [] },
        },
      }),
    });
  });
}
