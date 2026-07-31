import { z } from "zod";

import {
  authPolicy,
  isPlausibleEmail,
} from "@/features/auth/domain/auth-policy";
import { oauthProviders } from "@/features/auth/domain/oauth-types";
import { locales } from "@/i18n/config";

const emailSchema = z
  .string()
  .trim()
  .max(320)
  .refine(isPlausibleEmail, "Enter a valid email address.");

const passwordSchema = z
  .string()
  .min(authPolicy.passwordMinLength)
  .max(authPolicy.passwordMaxLength);

export const registerRequestSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    displayName: z.string().trim().min(2).max(120),
    locale: z.enum(locales),
    timeZone: z.string().trim().min(1).max(80),
  })
  .strict();

export const loginRequestSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(authPolicy.passwordMaxLength),
    deviceName: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const oneTimeTokenRequestSchema = z
  .object({
    token: z.string().min(32).max(256),
  })
  .strict();

export const forgotPasswordRequestSchema = z
  .object({
    email: emailSchema,
    locale: z.enum(locales),
  })
  .strict();

export const resetPasswordRequestSchema = z
  .object({
    token: z.string().min(32).max(256),
    password: passwordSchema,
  })
  .strict();

export const sessionIdSchema = z.uuid();

export const oauthProviderSchema = z.enum(oauthProviders);

export const oauthStartRequestSchema = z
  .object({
    locale: z.enum(locales),
    timeZone: z.string().trim().min(1).max(80),
    returnTo: z.string().trim().min(1).max(500),
  })
  .strict();

export const oauthCallbackQuerySchema = z
  .object({
    code: z.string().min(1).max(2048),
    state: z.string().min(32).max(256),
  })
  .strict();

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
