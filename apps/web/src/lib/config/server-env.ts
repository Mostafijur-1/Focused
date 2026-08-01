import "server-only";

import { z } from "zod";

const optionalSecret = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const serverEnvironmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  VERCEL_GIT_COMMIT_SHA: z.string().trim().min(7).max(64).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  AUTH_JWT_PRIVATE_KEY_BASE64: z.string().min(1).optional(),
  AUTH_JWT_PUBLIC_KEY_BASE64: z.string().min(1).optional(),
  AUTH_JWT_KEY_ID: z.string().trim().min(1).max(80).default("focused-local-1"),
  AUTH_JWT_ISSUER: z.url().optional(),
  AUTH_JWT_AUDIENCE: z.string().trim().min(1).max(120).default("focused-api"),
  AUTH_DATA_ENCRYPTION_KEY_BASE64: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  AUTH_EMAIL_FROM: z.string().trim().min(3).max(320).optional(),
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  GROQ_API_KEY: optionalSecret,
  GROQ_MODEL: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .default("llama-3.3-70b-versatile"),
  GROQ_ZERO_DATA_RETENTION: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  GEMINI_API_KEY: optionalSecret,
  GEMINI_MODEL: z.string().trim().min(1).max(120).default("gemini-3.6-flash"),
  GEMINI_SERVICE_TIER: z.enum(["unpaid", "paid"]).default("unpaid"),
  VAPID_SUBJECT: optionalSecret,
  VAPID_PUBLIC_KEY: optionalSecret,
  VAPID_PRIVATE_KEY: optionalSecret,
  QSTASH_TOKEN: optionalSecret,
  QSTASH_CURRENT_SIGNING_KEY: optionalSecret,
  QSTASH_NEXT_SIGNING_KEY: optionalSecret,
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

let cachedEnvironment: ServerEnvironment | undefined;

export function getServerEnvironment(): ServerEnvironment {
  if (cachedEnvironment) {
    return cachedEnvironment;
  }

  const result = serverEnvironmentSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    LOG_LEVEL: process.env.LOG_LEVEL,
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_JWT_PRIVATE_KEY_BASE64: process.env.AUTH_JWT_PRIVATE_KEY_BASE64,
    AUTH_JWT_PUBLIC_KEY_BASE64: process.env.AUTH_JWT_PUBLIC_KEY_BASE64,
    AUTH_JWT_KEY_ID: process.env.AUTH_JWT_KEY_ID,
    AUTH_JWT_ISSUER: process.env.AUTH_JWT_ISSUER,
    AUTH_JWT_AUDIENCE: process.env.AUTH_JWT_AUDIENCE,
    AUTH_DATA_ENCRYPTION_KEY_BASE64:
      process.env.AUTH_DATA_ENCRYPTION_KEY_BASE64,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL,
    GROQ_ZERO_DATA_RETENTION: process.env.GROQ_ZERO_DATA_RETENTION,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GEMINI_SERVICE_TIER: process.env.GEMINI_SERVICE_TIER,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    QSTASH_TOKEN: process.env.QSTASH_TOKEN,
    QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
    QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
  });

  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(`Invalid server environment configuration: ${fields}`);
  }

  cachedEnvironment = result.data;
  return cachedEnvironment;
}

export function resetServerEnvironmentForTests(): void {
  cachedEnvironment = undefined;
}
