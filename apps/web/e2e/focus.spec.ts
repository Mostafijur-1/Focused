import { expect, test, type Page } from "@playwright/test";

import {
  expectNoHorizontalOverflow,
  expectNoWcagViolations,
} from "./support/accessibility";
import { mockAuthenticatedSession } from "./support/auth-session";

const now = "2026-08-01T06:00:00.000Z";
const sessionId = "b94cd147-d8a9-46ec-9233-f23bf02cde26";

test.beforeEach(async ({ page }) => {
  await mockAuthenticatedSession(page, {
    permissions: ["focus:read:own", "focus:write:own"],
    displayName: "Focus Owner",
    accessToken: "focus-e2e-access",
  });
  await mockFocusApi(page);
});

test("renders an accessible Focus Timer without overflow", async ({ page }) => {
  await page.goto("/en/focus");

  await expect(
    page.getByRole("heading", { level: 1, name: "Focus Timer" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Start a calm Focus Session" }),
  ).toBeVisible();
  await expectNoWcagViolations(page);
  await expectNoHorizontalOverflow(page);
});

test("starts one retry-safe Deep Work session from a clear intent", async ({
  page,
}) => {
  let requestBody: Record<string, unknown> | undefined;
  await page.route("**/api/v1/focus-sessions", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    requestBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ data: runningSession }),
    });
  });

  await page.goto("/en/focus");
  await page
    .getByLabel("What will you do in this session?")
    .fill("Finish the release test plan");
  await page.getByRole("button", { name: "Start Focus" }).click();

  await expect(
    page.getByRole("heading", { name: "Finish the release test plan" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  expect(requestBody).toMatchObject({
    kind: "deep_work",
    intent: "Finish the release test plan",
    plannedSeconds: 3_000,
    goalId: null,
    pomodoroPresetId: null,
    pomodoroConfig: null,
  });
  expect(requestBody?.clientCommandId).toMatch(/^[0-9a-f-]{36}$/u);
});

async function mockFocusApi(page: Page) {
  await page.route("**/api/v1/focus-sessions", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          active: null,
          recent: [],
          presets: [],
          goalOptions: [],
          serverNow: now,
        },
      }),
    });
  });
}

const runningSession = {
  id: sessionId,
  goalId: null,
  goalTitle: null,
  pomodoroPresetId: null,
  kind: "deep_work",
  status: "running",
  intent: "Finish the release test plan",
  plannedSeconds: 3_000,
  focusedSeconds: 0,
  pausedSeconds: 0,
  interruptionCount: 0,
  timeZone: "Asia/Dhaka",
  startedAt: now,
  completedAt: null,
  abandonedAt: null,
  outcome: null,
  version: 1,
  activeInterval: null,
  pomodoroConfig: null,
  serverNow: now,
} as const;
