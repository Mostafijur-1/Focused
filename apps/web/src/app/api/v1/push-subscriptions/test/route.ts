import type { NextRequest } from "next/server";

import { getNotificationService } from "@/features/notifications/infrastructure/notification-container";
import { notificationActor } from "@/features/notifications/transport/notification-route";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute } from "@/lib/http/api-route";

export const runtime = "nodejs";

export function POST(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const actor = await notificationActor(request);
      await getNotificationService().testPush(actor);
      return apiSuccess({ data: { sent: true } }, requestId);
    },
    "Test Push request failed",
  );
}
