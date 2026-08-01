import type { NextRequest } from "next/server";
import { getFocusService } from "@/features/focus/infrastructure/focus-container";
import {
  focusActor,
  focusResourceId,
} from "@/features/focus/transport/focus-route";
import { presetMutationSchema } from "@/features/focus/transport/focus-schemas";
import { AppError } from "@/lib/errors/app-error";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";
export const runtime = "nodejs";
interface Context {
  readonly params: Promise<{ readonly presetId: string }>;
}
export function PATCH(request: NextRequest, context: Context) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, input, params] = await Promise.all([
        focusActor(request),
        parseJson(request, presetMutationSchema),
        context.params,
      ]);
      if (!input.expectedVersion)
        throw new AppError({
          code: "VALIDATION_ERROR",
          safeMessage: "expectedVersion is required.",
        });
      const data = await getFocusService().updatePreset(
        actor,
        focusResourceId(params.presetId),
        { ...input, expectedVersion: input.expectedVersion },
      );
      return apiSuccess({ data }, requestId);
    },
    "Pomodoro preset update failed",
  );
}
