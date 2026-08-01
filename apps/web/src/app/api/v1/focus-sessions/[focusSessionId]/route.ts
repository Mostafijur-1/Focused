import type { NextRequest } from "next/server";

import { getFocusService } from "@/features/focus/infrastructure/focus-container";
import {
  focusActor,
  focusResourceId,
} from "@/features/focus/transport/focus-route";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Context {
  readonly params: Promise<{ readonly focusSessionId: string }>;
}

export function GET(request: NextRequest, context: Context) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, params] = await Promise.all([
        focusActor(request),
        context.params,
      ]);
      const data = await getFocusService().detail(
        actor,
        focusResourceId(params.focusSessionId),
      );
      const response = apiSuccess({ data }, requestId);
      response.headers.set("cache-control", "private, no-store");
      response.headers.set("vary", "authorization");
      return response;
    },
    "Focus Session detail failed",
  );
}
