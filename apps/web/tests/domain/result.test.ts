import { describe, expect, it } from "vitest";

import { failure, success } from "@/domain/shared/result";

describe("Result", () => {
  it("represents a successful value", () => {
    expect(success({ id: "focus-1" })).toEqual({
      ok: true,
      value: { id: "focus-1" },
    });
  });

  it("represents a failure without throwing", () => {
    expect(failure("not-found")).toEqual({ ok: false, error: "not-found" });
  });
});
