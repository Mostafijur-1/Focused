import { Receiver } from "@upstash/qstash";

import { AppError } from "@/lib/errors/app-error";

export class QStashSignatureVerifier {
  private readonly receiver: Receiver | null;

  constructor(currentSigningKey?: string, nextSigningKey?: string) {
    this.receiver =
      currentSigningKey && nextSigningKey
        ? new Receiver({ currentSigningKey, nextSigningKey, devMode: false })
        : null;
  }

  async verify(request: Request, body: string): Promise<void> {
    if (!this.receiver) {
      throw new AppError({
        code: "DEPENDENCY_UNAVAILABLE",
        safeMessage: "Notification worker verification is not configured.",
      });
    }
    const signature = request.headers.get("upstash-signature");
    if (!signature) forbidden();
    try {
      const valid = await this.receiver.verify({
        signature,
        body,
        url: request.url,
        ...(request.headers.get("upstash-region")
          ? { upstashRegion: request.headers.get("upstash-region")! }
          : {}),
      });
      if (!valid) forbidden();
    } catch {
      forbidden();
    }
  }
}

function forbidden(): never {
  throw new AppError({
    code: "FORBIDDEN",
    safeMessage: "The worker signature is invalid.",
  });
}
