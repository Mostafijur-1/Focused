import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/server-only.ts", import.meta.url),
      ),
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
        "src/features/dashboard/domain/**/*.ts",
        "src/features/dashboard/application/**/*.ts",
        "src/features/dashboard/transport/**/*.ts",
        "src/features/habits/domain/**/*.ts",
        "src/features/habits/transport/habit-schemas.ts",
        "src/features/goals/domain/**/*.ts",
        "src/features/goals/transport/goal-schemas.ts",
        "src/features/ai/domain/**/*.ts",
        "src/features/ai/application/ai-rate-limiter.ts",
        "src/features/ai/infrastructure/providers/provider-error.ts",
        "src/features/ai/infrastructure/providers/provider-router.ts",
        "src/features/ai/infrastructure/providers/circuit-breaking-provider.ts",
        "src/features/ai/transport/ai-schemas.ts",
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
