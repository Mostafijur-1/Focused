import type { NextRequest } from "next/server";

import { getAIService } from "@/features/ai/infrastructure/ai-container";
import { aiActor } from "@/features/ai/transport/ai-route";
import { dailyReviewRequestSchema } from "@/features/ai/transport/ai-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, input] = await Promise.all([
        aiActor(request),
        parseJson(request, dailyReviewRequestSchema),
      ]);
      return apiSuccess(
        { data: await getAIService().dailyReview(actor, input) },
        requestId,
        { status: 201 },
      );
    },
    "AI Daily Review failed",
  );
}
