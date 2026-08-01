import { describe, expect, it } from "vitest";

import { serializeJsonLd } from "@/lib/seo/json-ld";

describe("serializeJsonLd", () => {
  it("produces valid JSON and escapes markup delimiters", () => {
    const serialized = serializeJsonLd({
      "@type": "WebApplication",
      description: "</script><script>alert(1)</script>",
    });

    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toMatchObject({
      "@type": "WebApplication",
      description: "</script><script>alert(1)</script>",
    });
  });
});
