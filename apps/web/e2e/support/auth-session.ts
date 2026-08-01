import type { Page } from "@playwright/test";

interface SessionOptions {
  readonly permissions: readonly string[];
  readonly displayName?: string;
  readonly accessToken?: string;
  readonly csrfToken?: string;
}

export async function mockAuthenticatedSession(
  page: Page,
  options: SessionOptions,
): Promise<void> {
  await page.context().addCookies([
    {
      name: "focused_csrf",
      value: options.csrfToken ?? "e2e-csrf-token",
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
        accessToken: options.accessToken ?? "e2e-access-token",
        expiresIn: 600,
        sessionId: "a6e4dd5a-6417-40bf-860e-ec8eed9e440a",
        user: {
          id: "34d9a956-bf9a-4b23-92b4-f03396d39527",
          displayName: options.displayName ?? "Focused Member",
          permissions: options.permissions,
        },
      }),
    }),
  );
}
