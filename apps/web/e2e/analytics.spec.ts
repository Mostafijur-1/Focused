import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const userId = "34d9a956-bf9a-4b23-92b4-b03396d39527";
const exportId = "7f23c7a1-63ca-4c3f-9dfc-22bedae6bb50";

test.beforeEach(async ({ page }) => {
  await page.context().addCookies([
    {
      name: "focused_csrf",
      value: "analytics-e2e-csrf",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "analytics-e2e-access",
        expiresIn: 600,
        sessionId: "a6e4dd5a-6417-40bf-860e-ec8eed9e440a",
        user: {
          id: userId,
          displayName: "Analytics Owner",
          permissions: [
            "analytics:read:own",
            "reports:write:own",
            "exports:write:own",
            "exports:read:own",
            "gamification:read:own",
            "gamification:write:own",
          ],
        },
      }),
    }),
  );
  await page.route("**/api/v1/analytics**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: analyticsSnapshot }),
    }),
  );
  await page.route("**/api/v1/gamification", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          enabled: true,
          version: 1,
          totalXp: 120,
          level: 2,
          levelTitle: "Rhythm",
          nextLevelXp: 300,
          achievements: [],
          streaks: [],
        },
      }),
    }),
  );
});

test("renders chart/table parity accessibly across mobile and desktop", async ({
  page,
}) => {
  await page.goto("/en/analytics");
  await expect(
    page.getByRole("heading", { level: 1, name: "Focus Analytics" }),
  ).toBeVisible();
  await expect(page.getByText("2.5 hr")).toBeVisible();
  await page.getByText("Detailed data table").click();
  await expect(page.getByRole("table")).toHaveCount(2);
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

test("applies a bounded date range and creates a privacy-filtered export", async ({
  page,
}) => {
  let query = "";
  await page.route("**/api/v1/analytics?**", async (route) => {
    query = new URL(route.request().url()).search;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: analyticsSnapshot }),
    });
  });
  await page.route("**/api/v1/exports", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: exportId,
          status: "completed",
          format: "csv",
          fileName: "focused.csv",
          contentType: "text/csv",
          checksum: "a".repeat(64),
          sizeBytes: 120,
          createdAt: "2026-08-01T12:00:00.000Z",
          expiresAt: "2026-08-08T12:00:00.000Z",
        },
      }),
    });
  });
  await page.goto("/en/analytics");
  await page.getByLabel("Start date").fill("2026-07-01");
  await page.getByLabel("End date").fill("2026-07-28");
  await page.getByRole("button", { name: "View range" }).click();
  await expect.poll(() => query).toContain("start=2026-07-01");
  await page.getByRole("button", { name: "Export CSV" }).click();
  await expect(page.getByText("Export ready.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download" })).toBeVisible();
});

const empty = {
  focusedSeconds: 0,
  plannedSeconds: 0,
  completedSessions: 0,
  abandonedSessions: 0,
  outcomesCaptured: 0,
  interruptionCount: 0,
  interruptionsByCategory: {},
  interruptionsByHour: {},
  habitDue: 0,
  habitCompleted: 0,
  habitSkipped: 0,
  habitExcused: 0,
  goalCheckIns: 0,
  goalProgressTotal: 0,
  weeklyPlansFinalized: 0,
};

const analyticsSnapshot = {
  schemaVersion: 1,
  metricVersion: "focused.analytics.v1",
  range: { start: "2026-07-01", end: "2026-07-28", days: 2 },
  timeZone: "Asia/Dhaka",
  computedAt: "2026-08-01T12:00:00.000Z",
  sourceThrough: "2026-08-01T11:59:00.000Z",
  freshness: "fresh",
  summary: {
    focusedSeconds: 9000,
    plannedSeconds: 10800,
    completedSessions: 3,
    abandonedSessions: 1,
    planAttainmentPercent: 83.3,
    outcomeRatePercent: 66.7,
    activeFocusDays: 2,
    interruptionCount: 3,
    habitDue: 5,
    habitEligible: 5,
    habitCompleted: 4,
    habitSkipped: 0,
    habitExcused: 0,
    habitCompletionPercent: 80,
    goalCheckIns: 1,
    averageGoalProgress: 50,
    weeklyPlansFinalized: 1,
  },
  daily: [
    {
      localDate: "2026-07-27",
      ...empty,
      focusedSeconds: 3600,
      plannedSeconds: 5400,
      completedSessions: 1,
      interruptionCount: 2,
      interruptionsByCategory: { phone: 2 },
      habitDue: 1,
      habitCompleted: 2,
    },
    {
      localDate: "2026-07-28",
      ...empty,
      focusedSeconds: 5400,
      plannedSeconds: 5400,
      completedSessions: 2,
      abandonedSessions: 1,
      interruptionCount: 1,
      interruptionsByCategory: { thought: 1 },
      habitCompleted: 2,
      goalCheckIns: 1,
      goalProgressTotal: 50,
      weeklyPlansFinalized: 1,
    },
  ],
  interruptions: {
    total: 3,
    byCategory: { phone: 2, thought: 1 },
    byHour: { "10": 2, "14": 1 },
    sampleSize: 3,
    disclosure: "self_reported_only",
  },
  definitions: [
    {
      key: "focused_seconds",
      version: 1,
      unit: "seconds",
      definition: "Completed sessions only.",
    },
  ],
  limitations: [],
};
