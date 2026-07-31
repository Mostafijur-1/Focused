import { z } from "zod";

import { getServerEnvironment } from "@/lib/config/server-env";
import { apiFailure, apiSuccess } from "@/lib/http/api-response";
import { createRequestContext } from "@/lib/http/request-context";

export const dynamic = "force-dynamic";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("focused-web"),
  version: z.string(),
  timestamp: z.iso.datetime(),
});

export function GET(request: Request) {
  const context = createRequestContext(request);

  try {
    const environment = getServerEnvironment();
    const body = healthResponseSchema.parse({
      status: "ok",
      service: "focused-web",
      version: environment.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "development",
      timestamp: new Date().toISOString(),
    });

    return apiSuccess(body, context.requestId);
  } catch (error) {
    return apiFailure(error, context.requestId);
  }
}
