const requestIdPattern = /^[a-zA-Z0-9._:-]{8,128}$/;

export interface RequestContext {
  readonly requestId: string;
  readonly startedAt: number;
}

export function createRequestContext(request: Request): RequestContext {
  const candidate = request.headers.get("x-request-id")?.trim();

  return {
    requestId:
      candidate && requestIdPattern.test(candidate)
        ? candidate
        : crypto.randomUUID(),
    startedAt: Date.now(),
  };
}
