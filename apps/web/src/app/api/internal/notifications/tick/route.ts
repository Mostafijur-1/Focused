import {
  getNotificationWorker,
  getNotificationWorkerVerifier,
} from "@/features/notifications/infrastructure/notification-container";
import type { NextRequest } from "next/server";
import { workerTickSchema } from "@/features/notifications/transport/notification-schemas";
import { apiSuccess } from "@/lib/http/api-response";
import { handleApiRoute } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function POST(request: NextRequest) {
  return handleApiRoute(
    request,
    async (requestId) => {
      const body = await request.text();
      await getNotificationWorkerVerifier().verify(request, body);
      workerTickSchema.parse(JSON.parse(body));
      const data = await getNotificationWorker().run();
      return apiSuccess({ data }, requestId);
    },
    "Notification worker request failed",
  );
}
