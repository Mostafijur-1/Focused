import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "lcov"],
      include: [
        "src/domain/**/*.ts",
        "src/i18n/**/*.ts",
        "src/lib/utils.ts",
        "src/lib/errors/**/*.ts",
        "src/lib/http/**/*.ts",
        "src/components/ui/**/*.tsx",
        "src/features/auth/domain/**/*.ts",
        "src/features/auth/application/**/*.ts",
        "src/features/auth/infrastructure/crypto/**/*.ts",
        "src/features/auth/infrastructure/rate-limit/in-memory-auth-rate-limiter.ts",
        "src/features/auth/transport/auth-schemas.ts",
        "src/features/auth/transport/request-security.ts",
      ],
      exclude: ["**/*.d.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
