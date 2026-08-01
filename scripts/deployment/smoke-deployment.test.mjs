import assert from "node:assert/strict";
import { test } from "node:test";

import { smokeDeployment } from "./smoke-deployment.mjs";

test("validates a complete localized deployment without credentials", async () => {
  const checks = await smokeDeployment({
    baseUrl: "https://focused.example/path-is-ignored",
    expectedVersion: "1234567890abcdef",
    fetcher: fixtureFetch,
  });
  assert.ok(checks.length >= 20);
  assert.ok(checks.every((check) => check.passed));
});

test("rejects a deployment with missing security headers", async () => {
  await assert.rejects(
    smokeDeployment({
      baseUrl: "https://focused.example",
      fetcher: async (url, init) => {
        const response = await fixtureFetch(url, init);
        if (new URL(url).pathname !== "/bn-BD") return response;
        return new Response(await response.text(), { status: 200 });
      },
    }),
    /MIME protection/u,
  );
});

async function fixtureFetch(input) {
  const url = new URL(input);
  const securityHeaders = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=()",
    "content-security-policy-report-only": "default-src 'self'",
  };
  if (url.pathname === "/") {
    return new Response(null, { status: 307, headers: { location: "/bn-BD" } });
  }
  if (url.pathname === "/api/v1/health") {
    return Response.json(
      { status: "ok", service: "focused-web", version: "1234567890ab" },
      {
        headers: {
          "cache-control": "private, no-store",
          "x-request-id": requestId,
        },
      },
    );
  }
  if (url.pathname === "/bn-BD" || url.pathname === "/en") {
    const locale = url.pathname.slice(1);
    return new Response(
      `<html lang="${locale}"><link rel="canonical"><link hreflang="${locale}"></html>`,
      { status: 200, headers: securityHeaders },
    );
  }
  if (url.pathname === "/manifest.webmanifest") {
    return Response.json({ display: "standalone", start_url: "/bn-BD" });
  }
  if (url.pathname === "/robots.txt") {
    return new Response(
      "Disallow: /api/\nSitemap: https://focused.example/sitemap.xml",
    );
  }
  if (url.pathname === "/sitemap.xml") {
    return new Response(
      "<url>https://focused.example/bn-BD</url><url>https://focused.example/en</url>",
    );
  }
  return new Response(null, { status: 404 });
}

const requestId = "deployment-smoke-20260801";
