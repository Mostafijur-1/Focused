import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ context, page }) => {
  await context.addCookies([
    {
      name: "focused_csrf",
      value: "habit-e2e-csrf",
      domain: "127.0.0.1",
      path: "/",
      sameSite: "Strict",
    },
  ]);
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "habit-e2e-access",
        expiresIn: 600,
        sessionId: "a6e4dd5a-6417-40bf-860e-ec8eed9e440a",
        user: {
          id: "34d9a956-bf9a-4b23-92b4-b03396d39527",
          displayName: "Habit Owner",
          permissions: ["habits:read:own", "habits:write:own"],
        },
      }),
    }),
  );
  await mockHabits(page);
});

test("shows a calm accessible habit workspace in both navigation layouts", async ({
  page,
}) => {
  await page.goto("/en/habits");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Small steps, durable change",
    }),
  ).toBeVisible();
  await expect(page.getByText("Read eight pages")).toBeVisible();
  await expect(
    page.getByText("Returning matters more than protecting a streak."),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);

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

test("creates a bounded schedule and records a retry-safe check-in", async ({
  page,
}) => {
  let createBody: Record<string, unknown> | undefined;
  let checkInBody: Record<string, unknown> | undefined;
  await page.route("**/api/v1/habits", async (route) => {
    if (route.request().method() === "POST") {
      createBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            ...habit,
            id: "8e383178-6027-4f5f-9050-b037d13eeb4f",
            title: createBody.title,
            version: 1,
          },
        }),
      });
      return;
    }
    await route.fallback();
  });
  await page.route("**/api/v1/habits/*/entries", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    checkInBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          ...habit,
          version: 2,
          today: {
            ...habit.today,
            status: "completed",
            entry: {
              id: "46a8159a-0a25-4704-9ad5-e810ff58a004",
              value: 8,
              completed: true,
              skippedReason: null,
              note: null,
              evidenceRef: null,
              recordedAt: "2026-08-01T06:01:00.000Z",
              correctedAt: null,
              undoneAt: null,
              version: 1,
            },
          },
        },
      }),
    });
  });
  await page.goto("/en/habits");
  await page.getByRole("button", { name: "New habit" }).click();
  await page.getByLabel("Habit name").fill("Walk outside");
  await page.getByRole("button", { name: "Save" }).click();
  await expect
    .poll(() => createBody)
    .toMatchObject({ title: "Walk outside", schedule: { type: "daily" } });
  expect(createBody?.clientCommandId).toMatch(/^[0-9a-f-]{36}$/u);

  const existingHabit = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Read eight pages" }),
  });
  await existingHabit.getByLabel("Today's amount").fill("8");
  await existingHabit.getByRole("button", { name: "Complete today" }).click();
  await expect
    .poll(() => checkInBody)
    .toMatchObject({ localDate: "2026-08-01", value: 8, skippedReason: null });
  expect(checkInBody?.clientCommandId).toMatch(/^[0-9a-f-]{36}$/u);
});

async function mockHabits(page: Page) {
  await page.route("**/api/v1/habits", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          localDate: "2026-08-01",
          timeZone: "Asia/Dhaka",
          active: [habit],
          archived: [],
          syncToken: "2026-08-01T06:00:00.000Z",
        },
      }),
    });
  });
  await page.route("**/api/v1/habits/*/entries", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { habit, occurrences: [habit.today], nextCursor: null },
      }),
    });
  });
}

const habit = {
  id: "b9c535c5-edb7-409d-a337-13331fb8e6a2",
  title: "Read eight pages",
  kind: "count",
  startsOn: "2026-08-01",
  paused: false,
  archived: false,
  version: 1,
  scheduleVersion: {
    id: "89f2bd01-6646-432f-8bb9-f2cc13dfbcb0",
    revision: 1,
    schedule: { type: "daily" },
    target: { value: 8, unit: "pages" },
    timeZone: "Asia/Dhaka",
    effectiveFrom: "2026-08-01",
    effectiveTo: null,
  },
  today: {
    id: "0f7b0ba6-0b39-4674-8769-adfd154a06d4",
    localDate: "2026-08-01",
    status: "due",
    target: { value: 8, unit: "pages" },
    entry: null,
  },
  consistency: {
    dueCount: 1,
    completedCount: 0,
    percentage: 0,
    currentStreak: 0,
  },
} as const;
