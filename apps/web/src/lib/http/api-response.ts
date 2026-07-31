import { NextResponse } from "next/server";
import { z } from "zod";

import { toAppError } from "@/lib/errors/app-error";

const apiProblemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  code: z.string().regex(/^[a-z0-9_]+$/),
  correlationId: z.string(),
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
  });

  const response = NextResponse.json(body, { status: appError.status });
  response.headers.set("content-type", "application/problem+json");
  response.headers.set("x-request-id", requestId);
  response.headers.set("cache-control", "no-store");
  return response;
}
