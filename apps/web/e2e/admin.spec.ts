import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const userId = "34d9a956-bf9a-4b23-92b4-b03396d39527";
const caseId = "27400aaa-0f95-4436-83d6-894e01447601";
const flagId = "f0fed090-f920-46f5-a092-4071bb08d3fd";

test.beforeEach(async ({ page }) => {
  await page.context().addCookies([
    {
      name: "focused_csrf",
      value: "admin-e2e",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accessToken: "admin-e2e-access",
        expiresIn: 600,
        sessionId: "a6e4dd5a-6417-40bf-860e-ec8eed9e440a",
        user: {
          id: userId,
          displayName: "Platform Operator",
          permissions: [
            "admin:access",
            "admin:mfa:manage:own",
            "admin:cases:read",
            "admin:cases:write",
            "admin:health:read",
            "admin:users:read:metadata",
            "admin:feature_flags:read",
            "admin:feature_flags:write",
            "admin:audit:read",
            "admin:jobs:read",
            "admin:jobs:retry",
            "admin:roles:read",
            "admin:roles:write",
          ],
        },
      }),
    }),
  );
  await jsonRoute(page, "**/api/v1/admin/mfa", {
    data: { status: "ACTIVE", sessionVerified: true, version: 3 },
  });
  await jsonRoute(page, "**/api/v1/admin/cases", {
    data: [
      {
        id: caseId,
        key: "CASE-20260801-ABCDE",
        externalReference: "SUP-100",
        reasonCode: "ACCOUNT_ACCESS",
        summary: "Investigate account access request.",
        status: "OPEN",
        expiresAt: "2026-08-02T12:00:00.000Z",
        createdAt: "2026-08-01T12:00:00.000Z",
        version: 1,
      },
    ],
  });
  await jsonRoute(page, "**/api/v1/admin/overview?**", {
    data: {
      generatedAt: "2026-08-01T12:00:00.000Z",
      accounts: {
        total: 12,
        verified: 10,
        byStatus: {
          PENDING_VERIFICATION: 1,
          ACTIVE: 10,
          SUSPENDED: 1,
          DELETION_PENDING: 0,
          DELETED: 0,
        },
      },
      activeSessions: 8,
      operations: {
        queuedJobs: 1,
        failedJobs: 0,
        pendingOutbox: 0,
        deadLetterOutbox: 0,
        failedDeliveries: 0,
        failedAiRuns: 0,
      },
    },
  });
  await jsonRoute(page, "**/api/v1/admin/health?**", {
    data: {
      checkedAt: "2026-08-01T12:00:00.000Z",
      overall: "operational",
      checks: [
        {
          key: "database",
          status: "operational",
          message: "Database query succeeded.",
        },
        { key: "groq", status: "operational", message: "Groq AI provider" },
      ],
    },
  });
  await jsonRoute(page, "**/api/v1/admin/feature-flags?**", {
    data: [
      {
        id: flagId,
        key: "ai.coach.enabled",
        description: "AI Coach rollout",
        owner: "platform",
        purpose: "Gradually expose the safe AI Coach workflow.",
        enabled: false,
        safeDefault: false,
        audience: {},
        reviewAt: null,
        expiresAt: null,
        rollbackPlan: "Disable the flag and verify service health.",
        version: 1,
        updatedAt: "2026-08-01T12:00:00.000Z",
      },
    ],
  });
  await jsonRoute(page, "**/api/v1/admin/audit-events?**", {
    data: {
      items: [
        {
          id: "37504dd6-d153-4aaf-914e-37a7946cbdb7",
          sequence: "5",
          actorUserId: userId,
          action: "admin.overview.read",
          targetType: "AdminCase",
          targetId: caseId,
          reasonCode: "ACCOUNT_ACCESS",
          correlationId: "request-admin-e2e",
          outcome: "ALLOWED",
          metadata: {},
          previousHash: "a".repeat(64),
          eventHash: "b".repeat(64),
          occurredAt: "2026-08-01T12:00:00.000Z",
        },
      ],
      nextCursor: null,
    },
  });
  await jsonRoute(page, "**/api/v1/admin/jobs?**", { data: [] });
  await jsonRoute(page, "**/api/v1/admin/role-changes?**", { data: [] });
});

test("renders privacy-minimized Admin operations accessibly at all breakpoints", async ({
  page,
}) => {
  await page.goto("/en/admin");
  await expect(
    page.getByRole("heading", { level: 1, name: "Safe platform operations" }),
  ).toBeVisible();
  await expect(page.getByText("12", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Routine Admin views never include journals/u),
  ).toBeVisible();
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

test("binds Feature Flag step-up to the exact target", async ({ page }) => {
  let stepUpBody: unknown;
  let receivedGrant = "";
  await page.route("**/api/v1/admin/step-up", async (route) => {
    stepUpBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ data: { token: "scoped-one-time-grant" } }),
    });
  });
  await page.route(`**/api/v1/admin/feature-flags/${flagId}`, async (route) => {
    receivedGrant = route.request().headers()["x-admin-step-up"] ?? "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: { id: flagId, version: 2, state: "enabled", replayed: false },
      }),
    });
  });

  await page.goto("/en/admin");
  await page.getByRole("button", { name: "Enable" }).click();
  await page.getByLabel("6-digit code").fill("123456");
  await page
    .getByLabel(/Current password/u)
    .fill("correct horse battery staple");
  await page.getByRole("button", { name: "Verify and run" }).click();

  await expect.poll(() => receivedGrant).toBe("scoped-one-time-grant");
  expect(stepUpBody).toMatchObject({
    scope: "FEATURE_FLAG_WRITE",
    targetType: "FeatureFlag",
    targetId: flagId,
  });
});

async function jsonRoute(
  page: import("@playwright/test").Page,
  url: string,
  body: unknown,
) {
  await page.route(url, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    }),
  );
}
