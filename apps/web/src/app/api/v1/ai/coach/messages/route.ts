import type { NextRequest } from "next/server";

import type { AIStreamEvent } from "@/features/ai/domain/ai-types";
import { getAIService } from "@/features/ai/infrastructure/ai-container";
import { aiActor } from "@/features/ai/transport/ai-route";
import { coachMessageSchema } from "@/features/ai/transport/ai-schemas";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return handleApiRoute(
    request,
    async () => {
      const [actor, input] = await Promise.all([
        aiActor(request),
        parseJson(request, coachMessageSchema),
      ]);
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const emit = (event: AIStreamEvent) => {
            controller.enqueue(
              encoder.encode(
                `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
              ),
            );
          };
          void getAIService()
            .streamCoach(actor, input, emit, request.signal)
            .catch((error: unknown) => {
              emit({
                type: "run.failed",
                runId: input.clientRequestId,
                code: "stream_failed",
                message: "The AI Coach stream could not be completed.",
              });
              void error;
            })
            .finally(() => controller.close());
        },
      });
      return new Response(stream, {
        status: 200,
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "private, no-cache, no-transform",
          connection: "keep-alive",
          "x-accel-buffering": "no",
        },
      });
    },
    "AI Coach stream setup failed",
  );
}
