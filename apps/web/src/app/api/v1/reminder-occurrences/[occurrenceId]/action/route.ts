import type { NextRequest } from "next/server";

import { getReminderService } from "@/features/notifications/infrastructure/notification-container";
import {
  notificationActor,
  occurrenceId,
} from "@/features/notifications/transport/notification-route";
import { occurrenceActionSchema } from "@/features/notifications/transport/notification-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ occurrenceId: string }>;
}

export function POST(request: NextRequest, context: Context) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, parameters, input] = await Promise.all([
        notificationActor(request),
        context.params,
        parseJson(request, occurrenceActionSchema),
      ]);
      const data = await getReminderService().actOnOccurrence(
        actor,
        occurrenceId(parameters.occurrenceId),
        input.action,
        input.expectedVersion,
        input.snoozedUntil,
      );
      return apiSuccess({ data: { status: data } }, requestId);
    },
    "Reminder occurrence request failed",
  );
}
