import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "../generated/client";

export type FocusedPrismaClient = PrismaClient;

const globalDatabase = globalThis as typeof globalThis & {
  focusedPrisma?: PrismaClient;
};

export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

export function getPrismaClient(connectionString: string): PrismaClient {
  if (globalDatabase.focusedPrisma) return globalDatabase.focusedPrisma;

  const client = createPrismaClient(connectionString);

  if (process.env.NODE_ENV !== "production") {
    globalDatabase.focusedPrisma = client;
  }

  return client;
}
