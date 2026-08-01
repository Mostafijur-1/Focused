import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const goal = {
  id: "ae7eac88-7709-49f8-a2e2-203ef8ab5db8",
  parentGoalId: null,
  title: "Ship the Focused beta",
  description: "Give people a calm place to direct their attention.",
  status: "active",
  horizon: "year",
  priority: 1,
  position: 0,
  progressMode: "manual",
  progress: 35,
  successMeasure: null,
  targetValue: null,
  targetUnit: null,
  targetDate: "2026-12-31",
  overdue: false,
  archived: false,
  version: 2,
  createdAt: "2026-08-01T06:00:00.000Z",
  updatedAt: "2026-08-01T06:00:00.000Z",
  milestones: [],
  keyResults: [],
  links: [],
  recentCheckIns: [],
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "goals-e2e-access",
        expiresIn: 600,
        sessionId: "a6e4dd5a-6417-40bf-860e-ec8eed9e440a",
        user: {
          id: "34d9a956-bf9a-4b23-92b4-b03396d39527",
          displayName: "Goal Owner",
          permissions: [
            "goals:read:own",
            "goals:write:own",
            "life_vision:read:own",
            "life_vision:write:own",
            "weekly_plans:read:own",
            "weekly_plans:write:own",
          ],
        },
      }),
    }),
  );
  await mockGoals(page);
});

test("renders an accessible responsive goal workspace", async ({ page }) => {
  await page.goto("/en/goals");
  await expect(
    page.getByRole("heading", { level: 1, name: "Goals and Life Vision" }),
  ).toBeVisible();
  await expect(page.getByText(goal.title)).toBeVisible();
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

test("creates a retry-safe goal command", async ({ page }) => {
  let body: Record<string, unknown> | undefined;
  await page.route("**/api/v1/goals", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    body = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          ...goal,
          id: "ddb71958-a6d8-42e1-ab4e-51ce85c25730",
          title: body.title,
          status: "draft",
          version: 1,
          progress: 0,
        },
      }),
    });
  });
  await page.goto("/en/goals");
  await page.getByRole("button", { name: "New goal" }).click();
  await page.getByLabel("Goal title").fill("Learn distributed systems");
  await page.getByRole("button", { name: "Save goal" }).click();
  await expect
    .poll(() => body)
    .toMatchObject({
      title: "Learn distributed systems",
      progressMode: "manual",
    });
  expect(body?.clientCommandId).toMatch(/^[0-9a-f-]{36}$/u);
});

async function mockGoals(page: Page) {
  await page.route("**/api/v1/goals", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { data: [goal], nextCursor: null, total: 1 },
      }),
    });
  });
  await page.route("**/api/v1/life-vision", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: null }),
    });
  });
}
