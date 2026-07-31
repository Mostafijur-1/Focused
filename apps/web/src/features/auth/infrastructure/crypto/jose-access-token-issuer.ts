import { importPKCS8, importSPKI, jwtVerify, SignJWT } from "jose";
import { z } from "zod";

import type {
  AccessTokenClaims,
  AccessTokenIssuer,
} from "@/features/auth/application/ports";
import { authPolicy } from "@/features/auth/domain/auth-policy";
import { AppError } from "@/lib/errors/app-error";

interface JoseAccessTokenOptions {
  readonly privateKey: string;
  readonly publicKey: string;
  readonly keyId: string;
  readonly issuer: string;
  readonly audience: string;
  readonly lifetimeSeconds?: number;
}

const claimsSchema = z.object({
  sub: z.uuid(),
  sid: z.uuid(),
  jti: z.uuid(),
  pv: z.number().int().positive(),
  permissions: z.array(z.string().min(1).max(120)).max(200),
});

export class JoseAccessTokenIssuer implements AccessTokenIssuer {
  readonly lifetimeSeconds: number;
  private readonly options: JoseAccessTokenOptions;
  private privateKeyPromise?: ReturnType<typeof importPKCS8>;
  private publicKeyPromise?: ReturnType<typeof importSPKI>;

  constructor(options: JoseAccessTokenOptions) {
    this.options = options;
    this.lifetimeSeconds =
      options.lifetimeSeconds ?? authPolicy.accessTokenSeconds;
  }

  async issue(claims: AccessTokenClaims, now: Date): Promise<string> {
    const issuedAt = Math.floor(now.getTime() / 1000);
    return new SignJWT({
      sid: claims.sessionId,
      pv: claims.permissionVersion,
      permissions: [...claims.permissions],
    })
      .setProtectedHeader({ alg: "EdDSA", typ: "JWT", kid: this.options.keyId })
      .setIssuer(this.options.issuer)
      .setAudience(this.options.audience)
      .setSubject(claims.subject)
      .setJti(claims.jwtId)
      .setIssuedAt(issuedAt)
      .setNotBefore(issuedAt - authPolicy.clockToleranceSeconds)
      .setExpirationTime(issuedAt + this.lifetimeSeconds)
      .sign(await this.privateKey());
  }

  async verify(token: string, now: Date): Promise<AccessTokenClaims> {
    try {
      const result = await jwtVerify(token, await this.publicKey(), {
        algorithms: ["EdDSA"],
        issuer: this.options.issuer,
        audience: this.options.audience,
        clockTolerance: authPolicy.clockToleranceSeconds,
        currentDate: now,
        typ: "JWT",
      });
      const claims = claimsSchema.parse(result.payload);
      return {
        subject: claims.sub,
        sessionId: claims.sid,
        jwtId: claims.jti,
        permissionVersion: claims.pv,
        permissions: claims.permissions,
      };
    } catch (cause) {
      throw new AppError({
        code: "AUTH_INVALID_CREDENTIALS",
        safeMessage: "The credentials or session are not valid.",
        cause,
      });
    }
  }

  private privateKey(): ReturnType<typeof importPKCS8> {
    this.privateKeyPromise ??= importPKCS8(this.options.privateKey, "EdDSA");
    return this.privateKeyPromise;
  }

  private publicKey(): ReturnType<typeof importSPKI> {
    this.publicKeyPromise ??= importSPKI(this.options.publicKey, "EdDSA");
    return this.publicKeyPromise;
  }
}
