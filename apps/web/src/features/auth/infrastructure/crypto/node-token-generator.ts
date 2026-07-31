import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { SecureTokenGenerator } from "@/features/auth/application/ports";

export class NodeTokenGenerator implements SecureTokenGenerator {
  opaque(bytes = 32): string {
    return randomBytes(bytes).toString("base64url");
  }

  digest(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex");
  }

  id(): string {
    return randomUUID();
  }
}
