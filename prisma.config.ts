import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Prisma CLI and migrations use Neon's direct endpoint. Runtime PrismaClient
  // receives DATABASE_URL through @prisma/adapter-neon in application code.
  datasource: {
    url: env("DIRECT_URL"),
  },
});
