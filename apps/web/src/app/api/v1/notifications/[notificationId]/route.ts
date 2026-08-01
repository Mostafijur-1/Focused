import type { NextRequest } from "next/server";

import { getNotificationService } from "@/features/notifications/infrastructure/notification-container";
import {
  notificationActor,
  notificationId,
} from "@/features/notifications/transport/notification-route";
import { notificationStateSchema } from "@/features/notifications/transport/notification-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ notificationId: string }>;
}

export function PATCH(request: NextRequest, context: Context) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, parameters, input] = await Promise.all([
        notificationActor(request),
        context.params,
        parseJson(request, notificationStateSchema),
      ]);
      const data = await getNotificationService().setState(
        actor,
        notificationId(parameters.notificationId),
        input.action,
        input.expectedVersion,
      );
      return apiSuccess({ data }, requestId);
    },
    "Notification update request failed",
  );
}
