import type { NextRequest } from "next/server";

import { getReminderService } from "@/features/notifications/infrastructure/notification-container";
import {
  notificationActor,
  reminderId,
} from "@/features/notifications/transport/notification-route";
import { reminderStateSchema } from "@/features/notifications/transport/notification-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ reminderId: string }>;
}

export function POST(request: NextRequest, context: Context) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, parameters, input] = await Promise.all([
        notificationActor(request),
        context.params,
        parseJson(request, reminderStateSchema),
      ]);
      const data = await getReminderService().setState(
        actor,
        reminderId(parameters.reminderId),
        input.action,
        input.expectedVersion,
      );
      return apiSuccess({ data }, requestId);
    },
    "Reminder state request failed",
  );
}
