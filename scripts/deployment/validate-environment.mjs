import { pathToFileURL } from "node:url";

const baseRequired = [
  "NEXT_PUBLIC_APP_URL",
  "DATABASE_URL",
  "DIRECT_URL",
  "AUTH_JWT_PRIVATE_KEY_BASE64",
  "AUTH_JWT_PUBLIC_KEY_BASE64",
  "AUTH_JWT_KEY_ID",
  "AUTH_JWT_ISSUER",
  "AUTH_JWT_AUDIENCE",
  "AUTH_DATA_ENCRYPTION_KEY_BASE64",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
];

const notificationVariables = [
  "VAPID_SUBJECT",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "QSTASH_TOKEN",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
];

export function validateDeploymentEnvironment(
  environment,
  { target = "preview", strictCapabilities = false } = {},
) {
  const errors = [];
  const warnings = [];
  for (const name of baseRequired) {
    if (!present(environment[name])) errors.push(`Missing ${name}.`);
  }

  const appUrl = safeUrl(environment.NEXT_PUBLIC_APP_URL);
  const issuer = safeUrl(environment.AUTH_JWT_ISSUER);
  const redisUrl = safeUrl(environment.UPSTASH_REDIS_REST_URL);
  if (!appUrl) errors.push("NEXT_PUBLIC_APP_URL must be an absolute URL.");
  if (!issuer) errors.push("AUTH_JWT_ISSUER must be an absolute URL.");
  if (!redisUrl) errors.push("UPSTASH_REDIS_REST_URL must be an absolute URL.");

  if (
    appUrl &&
    issuer &&
    normalizedOrigin(appUrl) !== normalizedOrigin(issuer)
  ) {
    errors.push("AUTH_JWT_ISSUER must match the application origin.");
  }
  if (target === "production" && appUrl?.protocol !== "https:") {
    errors.push("Production NEXT_PUBLIC_APP_URL must use HTTPS.");
  }
  if (
    target === "production" &&
    present(environment.DATABASE_URL) &&
    environment.DATABASE_URL === environment.DIRECT_URL
  ) {
    errors.push(
      "Production DATABASE_URL and DIRECT_URL must use separate pooled and direct endpoints.",
    );
  }

  const aiConfigured =
    present(environment.GROQ_API_KEY) || present(environment.GEMINI_API_KEY);
  if (!aiConfigured)
    warnings.push(
      "AI providers are not configured; deterministic fallback only.",
    );

  const notificationConfigured = notificationVariables.every((name) =>
    present(environment[name]),
  );
  const notificationPartiallyConfigured = notificationVariables.some((name) =>
    present(environment[name]),
  );
  if (notificationPartiallyConfigured && !notificationConfigured) {
    errors.push(
      "Web Push and QStash variables must be configured as a complete set.",
    );
  } else if (!notificationConfigured) {
    warnings.push(
      "Web Push delivery is not configured; the in-app inbox remains available.",
    );
  }

  if (strictCapabilities && !aiConfigured) {
    errors.push(
      "At least one AI provider is required for strict production capability validation.",
    );
  }
  if (strictCapabilities && !notificationConfigured) {
    errors.push(
      "Web Push and QStash are required for strict production capability validation.",
    );
  }

  return { errors, warnings };
}

function present(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function safeUrl(value) {
  if (!present(value)) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizedOrigin(url) {
  return url.origin.toLowerCase();
}

function parseArguments(arguments_) {
  const targetIndex = arguments_.indexOf("--target");
  const target = targetIndex >= 0 ? arguments_[targetIndex + 1] : "preview";
  if (target !== "preview" && target !== "production") {
    throw new Error("--target must be preview or production.");
  }
  return {
    target,
    strictCapabilities: arguments_.includes("--strict-capabilities"),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const options = parseArguments(process.argv.slice(2));
  const result = validateDeploymentEnvironment(process.env, options);
  for (const warning of result.warnings) console.warn(`warning: ${warning}`);
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`error: ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`Deployment environment is valid for ${options.target}.`);
  }
}
