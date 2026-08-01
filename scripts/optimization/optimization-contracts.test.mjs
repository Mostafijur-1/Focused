import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("PWA caches only an explicit public allowlist", async () => {
  const worker = await readFile("apps/web/public/sw.js", "utf8");
  const compactWorker = worker.replace(/\s+/gu, " ");
  assert.match(
    compactWorker,
    /PUBLIC_FALLBACKS = \[ "\/bn-BD", "\/en", "\/icon\.svg", "\/manifest\.webmanifest", \]/u,
  );
  assert.doesNotMatch(worker, /PUBLIC_FALLBACKS[^;]*\/api\//u);
  assert.match(
    worker,
    /request\.method !== "GET" \|\| request\.mode !== "navigate"/u,
  );
});

test("global registration bypasses stale service-worker caches", async () => {
  const registrar = await readFile(
    "apps/web/src/components/pwa/service-worker-registrar.tsx",
    "utf8",
  );
  assert.match(registrar, /updateViaCache: "none"/u);
  assert.match(registrar, /process\.env\.NODE_ENV !== "production"/u);
});

test("loading boundaries do not import full interactive workspaces", async () => {
  const dashboard = await readFile(
    "apps/web/src/app/[locale]/dashboard/loading.tsx",
    "utf8",
  );
  const habits = await readFile(
    "apps/web/src/app/[locale]/habits/loading.tsx",
    "utf8",
  );
  assert.doesNotMatch(dashboard, /ui\/dashboard"/u);
  assert.doesNotMatch(habits, /ui\/habits"/u);
});
