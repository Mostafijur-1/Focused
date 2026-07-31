import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getOAuthService } from "@/features/auth/infrastructure/auth-container";
import { setSessionCookies } from "@/features/auth/transport/auth-cookies";
import { handleAuthRoute } from "@/features/auth/transport/auth-route";
import {
  oauthCallbackQuerySchema,
  oauthProviderSchema,
} from "@/features/auth/transport/auth-schemas";
import {
  assertOAuthState,
  oauthStateCookieName,
  requestSecurityContext,
} from "@/features/auth/transport/request-security";
import { getServerEnvironment } from "@/lib/config/server-env";
import { AppError } from "@/lib/errors/app-error";

export const runtime = "nodejs";

interface RouteContext {
  readonly params: Promise<{ readonly provider: string }>;
}

export function GET(request: NextRequest, context: RouteContext) {
  return handleAuthRoute(request, async (requestId) => {
    const environment = getServerEnvironment();
    const provider = oauthProviderSchema.safeParse(
      (await context.params).provider,
    );
    if (!provider.success) {
      throw new AppError({
        code: "NOT_FOUND",
        safeMessage: "Provider not found.",
      });
    }
    const query = oauthCallbackQuerySchema.safeParse({
      code: request.nextUrl.searchParams.get("code"),
      state: request.nextUrl.searchParams.get("state"),
    });
    if (!query.success) {
      throw new AppError({
        code: "AUTH_INVALID_CREDENTIALS",
        safeMessage: "The OAuth transaction is invalid or has expired.",
      });
    }
    assertOAuthState(
      request.cookies.get(oauthStateCookieName(provider.data))?.value,
      query.data.state,
    );
    const completion = await getOAuthService().complete(
      provider.data,
      query.data.state,
      query.data.code,
      requestSecurityContext(request),
    );
    const response = NextResponse.redirect(
      new URL(completion.returnTo, environment.NEXT_PUBLIC_APP_URL),
      303,
    );
    response.headers.set("x-request-id", requestId);
    response.headers.set("cache-control", "no-store");
    setSessionCookies(
      response,
      completion.session,
      environment.NODE_ENV === "production",
    );
    response.cookies.set(oauthStateCookieName(provider.data), "", {
      httpOnly: true,
      secure: environment.NODE_ENV === "production",
      sameSite: "lax",
      path: `/api/v1/auth/oauth/${provider.data}/callback`,
      maxAge: 0,
    });
    return response;
  });
}
