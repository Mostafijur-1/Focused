export interface SessionUser {
  readonly id: string;
  readonly displayName: string;
  readonly permissions: readonly string[];
}

export interface ClientSession {
  readonly accessToken: string;
  readonly expiresIn: number;
  readonly sessionId: string;
  readonly user: SessionUser;
}

interface ApiProblem {
  readonly title?: string;
  readonly code?: string;
  readonly correlationId?: string;
  readonly errors?: readonly {
    readonly pointer?: string;
    readonly message: string;
  }[];
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly correlationId?: string,
    readonly fieldErrors: Readonly<Record<string, string>> = {},
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

export async function authFetch<T>(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.body) headers.set("content-type", "application/json");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
  });
  if (!response.ok) {
    const problem = await safeProblem(response);
    const fields = Object.fromEntries(
      (problem.errors ?? [])
        .filter((error) => error.pointer)
        .map((error) => [error.pointer!.replace(/^\//u, ""), error.message]),
    );
    throw new AuthApiError(
      problem.title ?? "The request could not be completed.",
      response.status,
      problem.code,
      problem.correlationId,
      fields,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function readCsrfToken(): string | null {
  const prefix = "focused_csrf=";
  const entry = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
}

async function safeProblem(response: Response): Promise<ApiProblem> {
  try {
    return (await response.json()) as ApiProblem;
  } catch {
    return {};
  }
}
