export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_EMAIL_NOT_VERIFIED"
  | "AUTH_TOKEN_INVALID"
  | "DEPENDENCY_UNAVAILABLE"
  | "INTERNAL_ERROR";

const statusByCode: Readonly<Record<AppErrorCode, number>> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  AUTH_INVALID_CREDENTIALS: 401,
  AUTH_EMAIL_NOT_VERIFIED: 403,
  AUTH_TOKEN_INVALID: 400,
  DEPENDENCY_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

interface AppErrorOptions {
  readonly code: AppErrorCode;
  readonly safeMessage: string;
  readonly status?: number;
  readonly cause?: unknown;
  readonly details?: Readonly<Record<string, unknown>>;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly safeMessage: string;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(options: AppErrorOptions) {
    super(
      options.safeMessage,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "AppError";
    this.code = options.code;
    this.status = options.status ?? statusByCode[options.code];
    this.safeMessage = options.safeMessage;
    if (options.details !== undefined) {
      this.details = options.details;
    }
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  return new AppError({
    code: "INTERNAL_ERROR",
    safeMessage: "The request could not be completed.",
    cause: error,
  });
}
