import type { NextRequest, NextResponse } from "next/server";
import type { z } from "zod";

import { AppError } from "@/lib/errors/app-error";
import { apiFailure } from "@/lib/http/api-response";
import { getRequestId } from "@/lib/http/request-context";
import { logger } from "@/lib/observability/logger";

export async function handleAuthRoute(
  request: NextRequest,
  operation: (requestId: string) => Promise<NextResponse>,
): Promise<NextResponse> {
  const requestId = getRequestId(request.headers);
  try {
    return await operation(requestId);
  } catch (error) {
    logger.error("Authentication request failed", {
      requestId,
      path: request.nextUrl.pathname,
      error,
    });
    return apiFailure(error, requestId);
  }
}

export async function parseJson<TSchema extends z.ZodType>(
  request: NextRequest,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new AppError({
      code: "VALIDATION_ERROR",
      safeMessage: "The request body must be valid JSON.",
      details: {
        errors: [{ code: "invalid_json", message: "Invalid JSON body." }],
      },
    });
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      status: 422,
      safeMessage: "Review the highlighted fields and try again.",
      details: {
        errors: result.error.issues.map((issue) => ({
          pointer: `/${issue.path.join("/")}`,
          code: issue.code,
          message: issue.message,
        })),
      },
    });
  }
  return result.data;
}
