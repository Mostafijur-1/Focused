import type { NextRequest } from "next/server";

import { getOAuthService } from "@/features/auth/infrastructure/auth-container";
import {
  handleAuthRoute,
  parseJson,
} from "@/features/auth/transport/auth-route";
import {
  oauthProviderSchema,
  oauthStartRequestSchema,
} from "@/features/auth/transport/auth-schemas";
import {
  assertTrustedOrigin,
  oauthStateCookieName,
} from "@/features/auth/transport/request-security";
import { getServerEnvironment } from "@/lib/config/server-env";
import { AppError } from "@/lib/errors/app-error";
import { apiSuccess } from "@/lib/http/api-response";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ readonly provider: string }>;
}

export function POST(request: NextRequest, context: RouteContext) {
  return handleAuthRoute(request, async (requestId) => {
    const environment = getServerEnvironment();
    assertTrustedOrigin(
      request,
      new URL(environment.NEXT_PUBLIC_APP_URL).origin,
    );
    const provider = oauthProviderSchema.safeParse(
      (await context.params).provider,
    );
    if (!provider.success) {
      throw new AppError({
        code: "NOT_FOUND",
        safeMessage: "Provider not found.",
      });
    }
    const input = await parseJson(request, oauthStartRequestSchema);
    const result = await getOAuthService().start({
      provider: provider.data,
      ...input,
    });
    const response = apiSuccess(
      {
        authorizationUrl: result.authorizationUrl,
        expiresAt: result.expiresAt.toISOString(),
      },
      requestId,
    );
    response.cookies.set(oauthStateCookieName(provider.data), result.state, {
      httpOnly: true,
      secure: environment.NODE_ENV === "production",
      sameSite: "lax",
      path: `/api/v1/auth/oauth/${provider.data}/callback`,
      expires: result.expiresAt,
      priority: "high",
    });
    return response;
  });
}
