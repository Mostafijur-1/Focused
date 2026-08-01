import type { NextRequest } from "next/server";

import { getAIService } from "@/features/ai/infrastructure/ai-container";
import { aiActor, aiResourceId } from "@/features/ai/transport/ai-route";
import { proposalDecisionSchema } from "@/features/ai/transport/ai-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  readonly params: Promise<{ readonly proposalId: string }>;
}

export function POST(request: NextRequest, context: RouteContext) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, input, params] = await Promise.all([
        aiActor(request),
        parseJson(request, proposalDecisionSchema),
        context.params,
      ]);
      return apiSuccess(
        {
          data: await getAIService().decideProposal(
            actor,
            aiResourceId(params.proposalId),
            input,
          ),
        },
        requestId,
      );
    },
    "AI proposal decision failed",
  );
}
