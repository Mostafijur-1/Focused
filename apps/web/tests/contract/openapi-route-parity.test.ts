/** @vitest-environment node */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import { describe, expect, it } from "vitest";

const apiRoot = resolve(process.cwd(), "src/app/api/v1");
const openApiPath = resolve(process.cwd(), "../../api/openapi.yaml");
const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

describe("REST implementation and OpenAPI parity", () => {
  it("documents every implemented method and implements every documented method", () => {
    const implemented = implementedOperations();
    const documented = documentedOperations();

    expect(
      setDifference(implemented, documented),
      "undocumented routes",
    ).toEqual([]);
    expect(
      setDifference(documented, implemented),
      "stale OpenAPI routes",
    ).toEqual([]);
  });

  it("keeps Authentication Google-only at the REST boundary", () => {
    const operations = implementedOperations();
    const forbidden = [
      "POST /auth/register",
      "POST /auth/login",
      "POST /auth/forgot-password",
      "POST /auth/reset-password",
      "POST /auth/verify-email",
    ];

    for (const operation of forbidden) {
      expect(operations.has(operation), operation).toBe(false);
    }
    expect(operations).toContain("POST /auth/oauth/{provider}/start");
    expect(operations).toContain("GET /auth/oauth/{provider}/callback");
  });
});

function implementedOperations(): Set<string> {
  const operations = new Set<string>();
  for (const routeFile of routeFiles(apiRoot)) {
    const routeDirectory = relative(apiRoot, dirname(routeFile));
    const routePath = `/${routeDirectory
      .split(sep)
      .map((segment) => segment.replace(/^\[(.+)\]$/u, "{$1}"))
      .join("/")}`;
    const source = readFileSync(routeFile, "utf8");

    for (const method of httpMethods) {
      const exportedHandler = new RegExp(
        `^export (?:async )?function ${method}\\b`,
        "mu",
      );
      if (exportedHandler.test(source))
        operations.add(`${method} ${routePath}`);
    }
  }
  return operations;
}

function documentedOperations(): Set<string> {
  const operations = new Set<string>();
  const lines = readFileSync(openApiPath, "utf8").split(/\r?\n/u);
  let insidePaths = false;
  let currentPath: string | null = null;

  for (const line of lines) {
    if (line === "paths:") {
      insidePaths = true;
      continue;
    }
    if (insidePaths && line === "components:") break;
    if (!insidePaths) continue;

    const pathMatch = /^  (\/[^:]+):$/u.exec(line);
    if (pathMatch) {
      currentPath = pathMatch[1] ?? null;
      continue;
    }
    const methodMatch = /^    (get|post|put|patch|delete):$/u.exec(line);
    if (currentPath && methodMatch) {
      operations.add(`${methodMatch[1]!.toUpperCase()} ${currentPath}`);
    }
  }
  return operations;
}

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.isFile() && entry.name === "route.ts" ? [path] : [];
  });
}

function setDifference(left: Set<string>, right: Set<string>): string[] {
  return [...left].filter((value) => !right.has(value)).sort();
}
