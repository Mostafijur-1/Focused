import type { NextRequest } from "next/server";

import { getAIService } from "@/features/ai/infrastructure/ai-container";
import { aiActor } from "@/features/ai/transport/ai-route";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const response = apiSuccess(
        { data: await getAIService().overview(await aiActor(request)) },
        requestId,
      );
      response.headers.set("cache-control", "private, no-store");
      response.headers.set("vary", "authorization");
      return response;
    },
    "AI overview failed",
  );
}
