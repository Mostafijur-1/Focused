import type { NextRequest, NextResponse } from "next/server";
import { handleApiRoute, parseJson } from "@/lib/http/api-route";

export async function handleAuthRoute(
  request: NextRequest,
  operation: (requestId: string) => Promise<NextResponse>,
): Promise<NextResponse> {
  return handleApiRoute(request, operation, "Authentication request failed");
}

export { parseJson };
