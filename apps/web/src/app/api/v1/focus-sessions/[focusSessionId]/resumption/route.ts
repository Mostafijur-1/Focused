import type { NextRequest } from "next/server";
import { getFocusService } from "@/features/focus/infrastructure/focus-container";
import {
  focusActor,
  focusResourceId,
} from "@/features/focus/transport/focus-route";
import { versionedFocusSchema } from "@/features/focus/transport/focus-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";
export const runtime = "nodejs";
interface Context {
  readonly params: Promise<{ readonly focusSessionId: string }>;
}
export function POST(request: NextRequest, context: Context) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, input, params] = await Promise.all([
        focusActor(request),
        parseJson(request, versionedFocusSchema),
        context.params,
      ]);
      const data = await getFocusService().resume(
        actor,
        focusResourceId(params.focusSessionId),
        input,
      );
      return apiSuccess({ data }, requestId);
    },
    "Focus Session resume failed",
  );
}
