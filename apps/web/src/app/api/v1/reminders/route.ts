import type { NextRequest } from "next/server";

import { getReminderService } from "@/features/notifications/infrastructure/notification-container";
import { notificationActor } from "@/features/notifications/transport/notification-route";
import { createReminderSchema } from "@/features/notifications/transport/notification-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const actor = await notificationActor(request);
      const data = await getReminderService().list(actor);
      return apiSuccess({ data }, requestId);
    },
    "Reminder list request failed",
  );
}

export function POST(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const actor = await notificationActor(request);
      const input = await parseJson(request, createReminderSchema);
      const data = await getReminderService().create(actor, input);
      return apiSuccess({ data }, requestId, { status: 201 });
    },
    "Reminder create request failed",
  );
}
