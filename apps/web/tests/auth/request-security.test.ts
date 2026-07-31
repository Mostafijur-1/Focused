/** @vitest-environment node */

import { NextRequest } from "next/server";

import {
  assertCsrf,
  assertOAuthState,
  assertTrustedOrigin,
  bearerToken,
  requestSecurityContext,
} from "@/features/auth/transport/request-security";

describe("authentication request security", () => {
  it("requires the exact origin and constant-time matching CSRF values", () => {
    const request = makeRequest({
      origin: "https://focused.test",
      cookie: "focused_csrf=a-secure-random-token-value",
      "x-csrf-token": "a-secure-random-token-value",
    });
    expect(() =>
      assertTrustedOrigin(request, "https://focused.test"),
    ).not.toThrow();
    expect(() => assertCsrf(request)).not.toThrow();

    expect(() =>
      assertTrustedOrigin(request, "https://preview.focused.test"),
    ).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(() =>
      assertCsrf(
        makeRequest({
          cookie: "focused_csrf=a-secure-random-token-value",
          "x-csrf-token": "different-token-value",
        }),
      ),
    ).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });

  it("extracts bearer credentials and rejects absent credentials", () => {
    expect(
      bearerToken(makeRequest({ authorization: "Bearer signed-access-token" })),
    ).toBe("signed-access-token");
    expect(() => bearerToken(makeRequest())).toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" }),
    );
  });

  it("validates OAuth state and records only minimized request metadata", () => {
    expect(() => assertOAuthState("same-state", "same-state")).not.toThrow();
    expect(() => assertOAuthState("same-state", "other-state")).toThrow(
      expect.objectContaining({ code: "AUTH_INVALID_CREDENTIALS" }),
    );

    const context = requestSecurityContext(
      makeRequest({
        "x-request-id": "request-12345678",
        "x-forwarded-for": "203.0.113.57, 10.0.0.1",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/140.0",
      }),
    );
    expect(context).toMatchObject({
      requestId: "request-12345678",
      ipPrefix: "203.0.113.0/24",
      deviceName: "Chrome on Windows",
    });
    expect(context.userAgentHash).toMatch(/^[a-f0-9]{64}$/u);
  });
});

function makeRequest(headers: HeadersInit = {}): NextRequest {
  return new NextRequest("https://focused.test/api/v1/auth/refresh", {
    method: "POST",
    headers,
  });
}
