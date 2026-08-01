import type { NextRequest } from "next/server";

import { getNotificationService } from "@/features/notifications/infrastructure/notification-container";
import {
  notificationActor,
  subscriptionId,
} from "@/features/notifications/transport/notification-route";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute } from "@/lib/http/api-route";

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ subscriptionId: string }>;
}

export function DELETE(request: NextRequest, context: Context) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, parameters] = await Promise.all([
        notificationActor(request),
        context.params,
      ]);
      await getNotificationService().revokePush(
        actor,
        subscriptionId(parameters.subscriptionId),
      );
      return apiSuccess({ data: { revoked: true } }, requestId);
    },
    "Push subscription revoke request failed",
  );
}
