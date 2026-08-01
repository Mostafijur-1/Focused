import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = readFileSync(".github/workflows/release.yml", "utf8");

test("keeps production release manual, approved, tagged, and immutable", () => {
  assert.match(workflow, /workflow_dispatch:/u);
  assert.doesNotMatch(workflow, /\n\s+push:/u);
  assert.match(
    workflow,
    /environment:\r?\n\s+name: \$\{\{ inputs\.target \}\}/u,
  );
  assert.match(workflow, /confirm_production/u);
  assert.match(workflow, /\^\[0-9a-f\]\{40\}\$/u);
  assert.match(workflow, /git tag --points-at HEAD --list 'v\*'/u);
  assert.match(workflow, /no successful Quality Gate run/u);
});

test("applies migrations before deploying one prebuilt artifact", () => {
  const migration = workflow.indexOf("pnpm db:migrate:deploy");
  const deployment = workflow.indexOf("vercel@58.4.4 deploy");
  assert.ok(migration > 0);
  assert.ok(deployment > migration);
  assert.match(workflow, /vercel@58\.4\.4 build/u);
  assert.match(workflow, /--prebuilt/u);
  assert.match(workflow, /attest-build-provenance@v3/u);
  assert.match(workflow, /smoke-deployment\.mjs/u);
});
