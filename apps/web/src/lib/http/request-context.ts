const requestIdPattern = /^[a-zA-Z0-9._:-]{8,128}$/;

export interface RequestContext {
  readonly requestId: string;
  readonly startedAt: number;
}

export function getRequestId(headers: Headers): string {
  const candidate = headers.get("x-request-id")?.trim();
  return candidate && requestIdPattern.test(candidate)
    ? candidate
    : crypto.randomUUID();
}

export function createRequestContext(request: Request): RequestContext {
  return {
    requestId: getRequestId(request.headers),
    startedAt: Date.now(),
  };
}
