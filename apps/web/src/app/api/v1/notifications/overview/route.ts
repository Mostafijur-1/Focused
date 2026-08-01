import type { NextRequest } from "next/server";

import { getNotificationService } from "@/features/notifications/infrastructure/notification-container";
import { notificationActor } from "@/features/notifications/transport/notification-route";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const actor = await notificationActor(request);
      const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
      const data = await getNotificationService().overview(actor, cursor);
      const response = apiSuccess({ data }, requestId);
      response.headers.set("cache-control", "private, no-store");
      response.headers.set("vary", "authorization");
      return response;
    },
    "Notification overview request failed",
  );
}
