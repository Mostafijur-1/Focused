import type { NextRequest } from "next/server";

import { getReminderService } from "@/features/notifications/infrastructure/notification-container";
import {
  notificationActor,
  reminderId,
} from "@/features/notifications/transport/notification-route";
import {
  deleteReminderQuerySchema,
  updateReminderSchema,
} from "@/features/notifications/transport/notification-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export const runtime = "nodejs";

interface Context {
  readonly params: Promise<{ reminderId: string }>;
}

export function PUT(request: NextRequest, context: Context) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, parameters, input] = await Promise.all([
        notificationActor(request),
        context.params,
        parseJson(request, updateReminderSchema),
      ]);
      const data = await getReminderService().update(
        actor,
        reminderId(parameters.reminderId),
        input,
      );
      return apiSuccess({ data }, requestId);
    },
    "Reminder update request failed",
  );
}

export function DELETE(request: NextRequest, context: Context) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const [actor, parameters] = await Promise.all([
        notificationActor(request),
        context.params,
      ]);
      const query = deleteReminderQuerySchema.parse(
        Object.fromEntries(request.nextUrl.searchParams),
      );
      await getReminderService().delete(
        actor,
        reminderId(parameters.reminderId),
        query.expectedVersion,
      );
      return apiSuccess({ data: { deleted: true } }, requestId);
    },
    "Reminder delete request failed",
  );
}
