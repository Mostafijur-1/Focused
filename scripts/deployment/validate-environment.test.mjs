import assert from "node:assert/strict";
import { test } from "node:test";

import { validateDeploymentEnvironment } from "./validate-environment.mjs";

const complete = {
  NEXT_PUBLIC_APP_URL: "https://focused.example",
  DATABASE_URL: "postgresql://pooled.example/focused",
  DIRECT_URL: "postgresql://direct.example/focused",
  AUTH_JWT_PRIVATE_KEY_BASE64: "private",
  AUTH_JWT_PUBLIC_KEY_BASE64: "public",
  AUTH_JWT_KEY_ID: "focused-2026-08",
  AUTH_JWT_ISSUER: "https://focused.example",
  AUTH_JWT_AUDIENCE: "focused-api",
  AUTH_DATA_ENCRYPTION_KEY_BASE64: "encryption",
  UPSTASH_REDIS_REST_URL: "https://redis.example",
  UPSTASH_REDIS_REST_TOKEN: "redis-token",
  GOOGLE_OAUTH_CLIENT_ID: "google-client",
  GOOGLE_OAUTH_CLIENT_SECRET: "google-secret",
  GROQ_API_KEY: "groq-key",
  VAPID_SUBJECT: "mailto:operations@example.com",
  VAPID_PUBLIC_KEY: "vapid-public",
  VAPID_PRIVATE_KEY: "vapid-private",
  QSTASH_TOKEN: "qstash-token",
  QSTASH_CURRENT_SIGNING_KEY: "qstash-current",
  QSTASH_NEXT_SIGNING_KEY: "qstash-next",
};

test("accepts a complete isolated production environment", () => {
  assert.deepEqual(
    validateDeploymentEnvironment(complete, {
      target: "production",
      strictCapabilities: true,
    }),
    { errors: [], warnings: [] },
  );
});

test("fails closed without exposing secret values", () => {
  const result = validateDeploymentEnvironment(
    {
      ...complete,
      AUTH_JWT_PRIVATE_KEY_BASE64: "",
      AUTH_JWT_ISSUER: "https://attacker.example",
      QSTASH_NEXT_SIGNING_KEY: "",
    },
    { target: "production", strictCapabilities: true },
  );
  assert.ok(
    result.errors.some((error) =>
      error.includes("AUTH_JWT_PRIVATE_KEY_BASE64"),
    ),
  );
  assert.ok(
    result.errors.some((error) => error.includes("application origin")),
  );
  assert.ok(result.errors.some((error) => error.includes("complete set")));
  assert.equal(JSON.stringify(result).includes("attacker.example"), false);
});

test("allows explicit degraded preview capabilities with warnings", () => {
  const result = validateDeploymentEnvironment(
    Object.fromEntries(
      Object.entries(complete).filter(
        ([name]) => name !== "GROQ_API_KEY" && !notificationVariables.has(name),
      ),
    ),
    { target: "preview" },
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 2);
});

const notificationVariables = new Set([
  "VAPID_SUBJECT",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "QSTASH_TOKEN",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
]);
