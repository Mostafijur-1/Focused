import { describe, expect, it } from "vitest";

import { AppError, toAppError } from "@/lib/errors/app-error";

describe("AppError", () => {
  it("maps a stable code to the correct status", () => {
    const error = new AppError({ code: "NOT_FOUND", safeMessage: "Missing" });

    expect(error.status).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
    expect(error.safeMessage).toBe("Missing");
  });

  it("preserves explicitly safe details", () => {
    const error = new AppError({
      code: "CONFLICT",
      safeMessage: "Changed",
      details: { version: 2 },
    });

    expect(error.details).toEqual({ version: 2 });
  });

  it("normalizes unknown failures without exposing their message", () => {
    const normalized = toAppError(new Error("database password leaked"));

    expect(normalized.code).toBe("INTERNAL_ERROR");
    expect(normalized.safeMessage).toBe("The request could not be completed.");
    expect(normalized.message).not.toContain("password");
  });

  it("returns an existing AppError unchanged", () => {
    const source = new AppError({ code: "FORBIDDEN", safeMessage: "Denied" });
    expect(toAppError(source)).toBe(source);
  });
});
