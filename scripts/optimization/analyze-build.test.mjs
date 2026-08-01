import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeBuild,
  parseBudgets,
  parseClientReferenceManifest,
} from "./analyze-build.mjs";

test("parses a Turbopack client reference manifest", () => {
  const manifest = parseClientReferenceManifest(
    'globalThis.__RSC_MANIFEST["/x"] = {"clientModules":{},"entryCSSFiles":{},"entryJSFiles":{}};',
  );
  assert.deepEqual(manifest.clientModules, {});
});

test("rejects an incomplete or non-positive budget", () => {
  assert.throws(
    () => parseBudgets({ schemaVersion: 1, routeJavaScriptGzipBytes: 0 }),
    /routeJavaScriptGzipBytes must be a positive safe integer/u,
  );
});

test("measures route assets and reports budget violations", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "focused-build-budget-"));
  const build = path.join(root, ".next");
  const manifestDirectory = path.join(
    build,
    "server",
    "app",
    "[locale]",
    "dashboard",
  );
  await mkdir(path.join(build, "static", "chunks"), { recursive: true });
  await mkdir(manifestDirectory, { recursive: true });
  await mkdir(path.join(root, "public"), { recursive: true });
  await writeFile(path.join(build, "static", "chunks", "route.js"), "route");
  await writeFile(path.join(build, "static", "chunks", "route.css"), "css");
  await writeFile(path.join(root, "public", "sw.js"), "worker");
  const payload = {
    clientModules: {
      dashboard: { chunks: ["/_next/static/chunks/route.js"] },
    },
    entryCSSFiles: {
      dashboard: [{ path: "static/chunks/route.css", inlined: false }],
    },
    entryJSFiles: {
      "[project]/apps/web/src/app/[locale]/layout": ["static/chunks/route.js"],
    },
  };
  await writeFile(
    path.join(manifestDirectory, "page_client-reference-manifest.js"),
    `globalThis.__RSC_MANIFEST["/[locale]/dashboard/page"] = ${JSON.stringify(payload)};`,
  );
  const budgetFile = path.join(root, "budget.json");
  await writeFile(
    budgetFile,
    JSON.stringify({
      schemaVersion: 1,
      routeJavaScriptGzipBytes: 1,
      routeStylesheetGzipBytes: 1,
      loadingJavaScriptGzipBytes: 1,
      serviceWorkerBytes: 1,
    }),
  );

  const report = await analyzeBuild({ buildDirectory: build, budgetFile });
  assert.equal(report.summary.passed, false);
  assert.equal(report.routes[0].route, "/[locale]/dashboard");
  assert.equal(report.routes[0].javascript.fileCount, 1);
  assert.equal(report.summary.violations.length, 4);
});
