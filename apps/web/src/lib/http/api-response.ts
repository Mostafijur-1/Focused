import { NextResponse } from "next/server";
import { z } from "zod";

import { toAppError } from "@/lib/errors/app-error";

const apiProblemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  code: z.string().regex(/^[a-z0-9_]+$/),
  correlationId: z.string(),
  errors: z
    .array(
      z.object({
        pointer: z.string().optional(),
        code: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
});

export function apiSuccess<TData>(
  data: TData,
  requestId: string,
  init?: ResponseInit,
): NextResponse<TData> {
  const response = NextResponse.json(data, init);
  response.headers.set("x-request-id", requestId);
  response.headers.set("cache-control", "no-store");
  return response;
}

export function apiFailure(
  error: unknown,
  requestId: string,
): NextResponse<z.infer<typeof apiProblemSchema>> {
  const appError = toAppError(error);
  const body = apiProblemSchema.parse({
    type: `https://focused.app/problems/${appError.code.toLowerCase()}`,
    title: appError.safeMessage,
    status: appError.status,
    code: appError.code.toLowerCase(),
    correlationId: requestId,
    errors:
      appError.code === "VALIDATION_ERROR" &&
      Array.isArray(appError.details?.errors)
        ? appError.details.errors
        : undefined,
  });

  const response = NextResponse.json(body, { status: appError.status });
  response.headers.set("content-type", "application/problem+json");
  response.headers.set("x-request-id", requestId);
  response.headers.set("cache-control", "no-store");
  if (appError.status === 401)
    response.headers.set("www-authenticate", "Bearer");
  if (
    appError.status === 429 &&
    typeof appError.details?.retryAfterSeconds === "number"
  ) {
    response.headers.set(
      "retry-after",
      String(appError.details.retryAfterSeconds),
    );
  }
  return response;
}
