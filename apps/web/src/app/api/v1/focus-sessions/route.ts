import type { NextRequest } from "next/server";

import { getFocusService } from "@/features/focus/infrastructure/focus-container";
import { focusActor } from "@/features/focus/transport/focus-route";
import { startFocusSchema } from "@/features/focus/transport/focus-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const data = await getFocusService().overview(await focusActor(request));
      const response = apiSuccess({ data }, requestId);
      response.headers.set("cache-control", "private, no-store");
      response.headers.set("vary", "authorization");
      return response;
    },
    "Focus Session overview failed",
  );
}

export function POST(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, input] = await Promise.all([
        focusActor(request),
        parseJson(request, startFocusSchema),
      ]);
      return apiSuccess(
        { data: await getFocusService().start(actor, input) },
        requestId,
        { status: 201 },
      );
    },
    "Focus Session start failed",
  );
}
