import type { NextRequest } from "next/server";

import { getNotificationService } from "@/features/notifications/infrastructure/notification-container";
import { notificationActor } from "@/features/notifications/transport/notification-route";
import { preferenceUpdateSchema } from "@/features/notifications/transport/notification-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const actor = await notificationActor(request);
      const data = await getNotificationService().preferences(actor);
      return apiSuccess({ data }, requestId);
    },
    "Notification preference request failed",
  );
}

export function PATCH(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const actor = await notificationActor(request);
      const input = await parseJson(request, preferenceUpdateSchema);
      const data = await getNotificationService().updatePreferences(
        actor,
        input,
      );
      return apiSuccess({ data }, requestId);
    },
    "Notification preference update failed",
  );
}
