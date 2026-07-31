import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ context, page }) => {
  await context.addCookies([
    {
      name: "focused_csrf",
      value: "dashboard-e2e-csrf",
      domain: "127.0.0.1",
      path: "/",
      sameSite: "Strict",
    },
  ]);
  await page.route("**/api/v1/auth/refresh", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "dashboard-e2e-access",
        expiresIn: 600,
        sessionId: "28a5a168-a174-4b55-bc8b-45573fb6f4bf",
        user: {
          id: "2a4f60e2-3f8a-4828-bf55-e93182f99441",
          displayName: "মোস্তাফিজুর",
          permissions: ["dashboard:read:own", "dashboard:widgets:update:own"],
        },
      }),
    });
  });
  await mockDashboard(page, dashboardSnapshot);
});

test("renders one calm primary action, partial state, and accessible landmarks", async ({
  page,
}) => {
  await page.goto("/bn-BD/dashboard");

  await expect(
    page.getByRole("heading", { level: 1, name: /স্বাগতম, মোস্তাফিজুর/u }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "আজকের Focus ঠিক করুন" }),
  ).toHaveCount(1);
  await expect(page.getByText(/কিছু তথ্য এখন পাওয়া যাচ্ছে না/u)).toBeVisible();
  const navigationName =
    (page.viewportSize()?.width ?? 1280) >= 768
      ? "অ্যাপ নেভিগেশন"
      : "মোবাইল নেভিগেশন";
  await expect(
    page.getByRole("navigation", { name: navigationName }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "মনোযোগের নীতি" }),
  ).toBeVisible();

  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("updates widget order with keyboard-accessible controls", async ({
  page,
}) => {
  let updatedBody: unknown;
  await page.route("**/api/v1/dashboard/widgets", async (route) => {
    updatedBody = route.request().postDataJSON();
    const input = updatedBody as typeof dashboardSnapshot.layout;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { version: 2, widgets: input.widgets } }),
    });
  });
  await page.goto("/bn-BD/dashboard");
  await page.getByText("Dashboard সাজান").click();
  await page.getByRole("button", { name: "নিচে নিন: Focus Session" }).click();
  await page.getByRole("button", { name: "বিন্যাস সংরক্ষণ করুন" }).click();

  await expect(
    page.getByText("Dashboard বিন্যাস সংরক্ষিত হয়েছে।"),
  ).toBeVisible();
  expect(updatedBody).toMatchObject({ expectedVersion: 1 });
});

test("uses the current-tab snapshot when the Dashboard request goes offline", async ({
  page,
}) => {
  await page.goto("/bn-BD/dashboard");
  await expect(page.getByText("Milestone 4 শেষ করা")).toBeVisible();
  await page.unroute("**/api/v1/dashboard");
  await page.route("**/api/v1/dashboard", (route) =>
    route.abort("internetdisconnected"),
  );
  await page.getByRole("button", { name: "আবার চেষ্টা করুন" }).click();

  await expect(page.getByText(/আপনি Offline আছেন/u)).toBeVisible();
  await expect(page.getByText("Milestone 4 শেষ করা")).toBeVisible();
});

test("does not overflow at target widths or 200 percent text zoom", async ({
  page,
}) => {
  await page.goto("/bn-BD/dashboard");
  for (const width of [320, 768, 1024, 1280]) {
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
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

async function mockDashboard(page: Page, snapshot: typeof dashboardSnapshot) {
  await page.route("**/api/v1/dashboard", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "private, no-store" },
      body: JSON.stringify({ data: snapshot }),
    });
  });
}

const widgets = [
  "today_focus",
  "active_session",
  "weekly_progress",
  "habits",
  "goals",
  "reminders",
  "ai_coach",
].map((key) => ({ key, visible: true }));

const dashboardSnapshot = {
  schemaVersion: 1,
  localDate: "2026-07-31",
  timeZone: "Asia/Dhaka",
  computedAt: "2026-07-31T12:00:00.000Z",
  sourceThrough: "2026-07-31T12:00:00.000Z",
  staleAfter: "2026-07-31T12:05:00.000Z",
  freshness: "fresh",
  data: {
    displayName: "মোস্তাফিজুর",
    todayFocus: {
      state: "ready",
      priorities: [
        {
          id: "a807a28f-d690-4746-8c5f-ad1522b27cda",
          title: "Milestone 4 শেষ করা",
          status: "in_progress",
        },
      ],
      completedCount: 0,
      totalCount: 1,
    },
    focusSession: { state: "not_configured", session: null },
    weeklyProgress: {
      state: "ready",
      completedPriorities: 3,
      totalPriorities: 5,
      focusedSeconds: 7200,
    },
    habits: { state: "unavailable", completedCount: 0, dueCount: 0 },
    goals: {
      state: "ready",
      activeCount: 1,
      nextGoal: {
        id: "62d78cd6-53e4-48e6-bbba-a547c0bc4e1c",
        title: "Focused alpha",
      },
    },
    reminders: { state: "ready", dueCount: 0, nextReminder: null },
    aiCoach: { state: "coming_soon" },
  },
  layout: { version: 1, widgets },
  degradations: [{ source: "habits", code: "source_unavailable" }],
} as const;
