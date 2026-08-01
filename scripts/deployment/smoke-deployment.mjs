import { pathToFileURL } from "node:url";

const requestId = "deployment-smoke-20260801";

export async function smokeDeployment({
  baseUrl,
  expectedVersion,
  fetcher = fetch,
}) {
  const origin = normalizedBaseUrl(baseUrl);
  const checks = [];

  const root = await request(fetcher, `${origin}/`, { redirect: "manual" });
  check(checks, "root redirect", root.status === 307);
  check(checks, "Bangla root", root.headers.get("location") === "/bn-BD");

  const health = await request(fetcher, `${origin}/api/v1/health`, {
    headers: { "x-request-id": requestId },
  });
  const healthBody = await health.json();
  check(
    checks,
    "health status",
    health.status === 200 && healthBody.status === "ok",
  );
  check(checks, "health service", healthBody.service === "focused-web");
  check(
    checks,
    "health correlation",
    health.headers.get("x-request-id") === requestId,
  );
  check(
    checks,
    "health no-store",
    includesToken(health.headers.get("cache-control"), "no-store"),
  );
  if (expectedVersion) {
    check(
      checks,
      "release version",
      healthBody.version === expectedVersion.slice(0, 12),
    );
  }

  for (const locale of ["bn-BD", "en"]) {
    const page = await request(fetcher, `${origin}/${locale}`);
    const html = await page.text();
    check(checks, `${locale} page`, page.status === 200);
    check(
      checks,
      `${locale} language`,
      html.includes(`<html lang="${locale}"`),
    );
    check(checks, `${locale} canonical`, /rel="canonical"/iu.test(html));
    check(checks, `${locale} alternate`, /hreflang="/iu.test(html));
    assertSecurityHeaders(checks, locale, page.headers);
  }

  const manifest = await request(fetcher, `${origin}/manifest.webmanifest`);
  const manifestBody = await manifest.json();
  check(
    checks,
    "PWA manifest",
    manifest.status === 200 && manifestBody.display === "standalone",
  );
  check(checks, "PWA Bangla start", manifestBody.start_url === "/bn-BD");

  const robots = await request(fetcher, `${origin}/robots.txt`);
  const robotsBody = await robots.text();
  check(
    checks,
    "robots policy",
    robots.status === 200 && robotsBody.includes("Disallow: /api/"),
  );
  check(checks, "robots sitemap", robotsBody.includes(`${origin}/sitemap.xml`));

  const sitemap = await request(fetcher, `${origin}/sitemap.xml`);
  const sitemapBody = await sitemap.text();
  check(
    checks,
    "localized sitemap",
    sitemap.status === 200 &&
      sitemapBody.includes(`${origin}/bn-BD`) &&
      sitemapBody.includes(`${origin}/en`),
  );

  return checks;
}

function assertSecurityHeaders(checks, locale, headers) {
  check(
    checks,
    `${locale} MIME protection`,
    headers.get("x-content-type-options") === "nosniff",
  );
  check(
    checks,
    `${locale} frame protection`,
    headers.get("x-frame-options") === "DENY",
  );
  check(
    checks,
    `${locale} referrer policy`,
    headers.get("referrer-policy") === "strict-origin-when-cross-origin",
  );
  check(
    checks,
    `${locale} permissions policy`,
    Boolean(headers.get("permissions-policy")),
  );
  check(
    checks,
    `${locale} CSP report mode`,
    Boolean(headers.get("content-security-policy-report-only")),
  );
}

function check(checks, name, passed) {
  checks.push({ name, passed });
  if (!passed) throw new Error(`Deployment smoke check failed: ${name}.`);
}

function includesToken(value, token) {
  return value
    ?.split(",")
    .map((part) => part.trim().toLowerCase())
    .includes(token);
}

function normalizedBaseUrl(value) {
  const url = new URL(value);
  if (!/^https?:$/u.test(url.protocol))
    throw new Error("Base URL must use HTTP or HTTPS.");
  return url.origin;
}

async function request(fetcher, url, init = {}) {
  const response = await fetcher(url, {
    ...init,
    signal: AbortSignal.timeout(10_000),
  });
  return response;
}

function parseArguments(arguments_) {
  const value = (name) => {
    const index = arguments_.indexOf(name);
    return index >= 0 ? arguments_[index + 1] : undefined;
  };
  const baseUrl = value("--base-url");
  if (!baseUrl) throw new Error("--base-url is required.");
  return { baseUrl, expectedVersion: value("--expected-version") };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const checks = await smokeDeployment(parseArguments(process.argv.slice(2)));
    for (const result of checks) console.log(`ok: ${result.name}`);
    console.log(`${checks.length} deployment smoke checks passed.`);
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Deployment smoke failed.",
    );
    process.exitCode = 1;
  }
}
