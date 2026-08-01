import type { NextRequest } from "next/server";

import { getNotificationService } from "@/features/notifications/infrastructure/notification-container";
import { notificationActor } from "@/features/notifications/transport/notification-route";
import { pushSubscriptionSchema } from "@/features/notifications/transport/notification-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export const runtime = "nodejs";

export function POST(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const actor = await notificationActor(request);
      const input = await parseJson(request, pushSubscriptionSchema);
      const data = await getNotificationService().registerPush(actor, {
        ...input,
        userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      });
      return apiSuccess({ data }, requestId, { status: 201 });
    },
    "Push subscription request failed",
  );
}
