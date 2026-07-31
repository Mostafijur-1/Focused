import { defineConfig } from "prisma/config";

const localDevelopmentUrl =
  "postgresql://focused:focused@127.0.0.1:5432/focused?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Prisma CLI and migrations use Neon's direct endpoint. Runtime PrismaClient
  // receives DATABASE_URL through @prisma/adapter-neon in application code.
  datasource: {
    url: process.env.DIRECT_URL ?? localDevelopmentUrl,
  },
});
