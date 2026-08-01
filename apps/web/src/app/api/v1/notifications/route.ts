import type { NextRequest } from "next/server";

import { getNotificationService } from "@/features/notifications/infrastructure/notification-container";
import { notificationActor } from "@/features/notifications/transport/notification-route";
import { inboxQuerySchema } from "@/features/notifications/transport/notification-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const actor = await notificationActor(request);
      const query = inboxQuerySchema.parse(
        Object.fromEntries(request.nextUrl.searchParams),
      );
      const data = await getNotificationService().inbox(
        actor,
        query.cursor,
        query.limit,
      );
      const response = apiSuccess({ data }, requestId);
      response.headers.set("cache-control", "private, no-store");
      response.headers.set("vary", "authorization");
      return response;
    },
    "Notification inbox request failed",
  );
}
