import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const userId = "34d9a956-bf9a-4b23-92b4-b03396d39527";
const conversationId = "d749881d-06fb-4a52-982e-574fcfb28e05";
const runId = "f410b3aa-f092-4131-8a4f-048801288d05";

test.beforeEach(async ({ page }) => {
  await page.context().addCookies([
    {
      name: "focused_csrf",
      value: "ai-e2e-csrf",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "ai-e2e-access",
        expiresIn: 600,
        sessionId: "a6e4dd5a-6417-40bf-860e-ec8eed9e440a",
        user: {
          id: userId,
          displayName: "AI Owner",
          permissions: ["ai:read:own", "ai:write:own", "ai:proposal:apply:own"],
        },
      }),
    }),
  );
  await mockOverview(page);
});

test("renders an accessible Bangla-first consent and Coach workspace", async ({
  page,
}) => {
  await page.goto("/bn-BD/coach");
  await expect(
    page.getByRole("heading", { level: 1, name: "আপনার AI Coach" }),
  ).toBeVisible();
  await expect(page.getByText("আপনার তথ্য, আপনার অনুমতি")).toBeVisible();
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

test("streams a Coach turn with only the member-selected context scope", async ({
  page,
}) => {
  let requestBody: Record<string, unknown> | undefined;
  await page.route("**/api/v1/ai/coach/messages", async (route) => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    const message = {
      id: "2e092892-06ce-4802-b2c8-1c74df687154",
      role: "assistant",
      content: "আজ একটি ছোট Focus Session দিয়ে শুরু করুন।",
      citations: [],
      model: "groq-model",
      createdAt: "2026-08-01T12:00:01.000Z",
    };
    const events = [
      { type: "run.started", runId, conversationId },
      { type: "message.delta", runId, delta: message.content },
      { type: "run.completed", runId, message, proposals: [] },
    ];
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: events
        .map(
          (event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
        )
        .join(""),
    });
  });
  await page.goto("/bn-BD/coach");
  await page.getByText("Focus Session-এর summary").click();
  await page.getByLabel("আপনার কথা").fill("আজ কীভাবে শুরু করব?");
  await page.getByRole("button", { name: "পাঠান" }).click();
  await expect(
    page.getByText("আজ একটি ছোট Focus Session দিয়ে শুরু করুন।"),
  ).toBeVisible();
  await expect
    .poll(() => requestBody)
    .toMatchObject({
      locale: "bn-BD",
      contextScopes: ["focus_summary"],
    });
  expect(requestBody?.clientRequestId).toMatch(/^[0-9a-f-]{36}$/u);
});

async function mockOverview(page: Page) {
  await page.route("**/api/v1/ai", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          available: true,
          unavailableReason: null,
          conversations: [],
          latestDailyReview: null,
          pendingProposals: [],
          allowedScopes: [
            "daily_plan",
            "focus_summary",
            "habit_summary",
            "goal_summary",
          ],
        },
      }),
    });
  });
}
