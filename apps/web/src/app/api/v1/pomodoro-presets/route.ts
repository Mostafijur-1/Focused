import type { NextRequest } from "next/server";
import { getFocusService } from "@/features/focus/infrastructure/focus-container";
import { focusActor } from "@/features/focus/transport/focus-route";
import { presetMutationSchema } from "@/features/focus/transport/focus-schemas";
import { AppError } from "@/lib/errors/app-error";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";
export const runtime = "nodejs";
export function POST(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, input] = await Promise.all([
        focusActor(request),
        parseJson(request, presetMutationSchema),
      ]);
      if (!input.clientCommandId)
        throw new AppError({
          code: "VALIDATION_ERROR",
          safeMessage: "clientCommandId is required.",
        });
      const data = await getFocusService().createPreset(actor, {
        ...input,
        clientCommandId: input.clientCommandId,
      });
      return apiSuccess({ data }, requestId, { status: 201 });
    },
    "Pomodoro preset creation failed",
  );
}
