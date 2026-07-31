import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";

import { AppError } from "@/lib/errors/app-error";
import { apiFailure, apiSuccess } from "@/lib/http/api-response";
import { parseJson } from "@/lib/http/api-route";
import { createRequestContext } from "@/lib/http/request-context";

describe("request context", () => {
  it("keeps a valid upstream request ID", () => {
    const request = new Request("https://focused.test", {
      headers: { "x-request-id": "trace-12345678" },
    });
    expect(createRequestContext(request).requestId).toBe("trace-12345678");
  });

  it("replaces a malformed request ID", () => {
    const request = new Request("https://focused.test", {
      headers: { "x-request-id": "<script>" },
    });
    expect(createRequestContext(request).requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("API responses", () => {
  it("returns successful data with request and cache headers", async () => {
    const response = apiSuccess({ status: "ok" }, "trace-12345678", {
      status: 200,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("trace-12345678");
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("returns only safe error fields", async () => {
    const response = apiFailure(
      new AppError({
        code: "VALIDATION_ERROR",
        safeMessage: "Invalid input",
        details: { password: "secret" },
      }),
      "trace-12345678",
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      type: "https://focused.app/problems/validation_error",
      title: "Invalid input",
      status: 400,
      code: "validation_error",
      correlationId: "trace-12345678",
    });
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
  });
});

describe("API JSON parsing", () => {
  const schema = z.object({ count: z.number().int().positive() }).strict();

  it("returns validated request data", async () => {
    const request = new NextRequest("https://focused.test/api", {
      method: "POST",
      body: JSON.stringify({ count: 2 }),
    });

    await expect(parseJson(request, schema)).resolves.toEqual({ count: 2 });
  });

  it("rejects malformed JSON and schema violations safely", async () => {
    const malformed = new NextRequest("https://focused.test/api", {
      method: "POST",
      body: "{",
    });
    const invalid = new NextRequest("https://focused.test/api", {
      method: "POST",
      body: JSON.stringify({ count: 0, secret: "not accepted" }),
    });

    await expect(parseJson(malformed, schema)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(parseJson(invalid, schema)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 422,
    });
  });
});
