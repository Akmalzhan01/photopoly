import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { poolConfig } from "./pg-ssl";

/**
 * One client per process. Next.js reloads modules on every edit in development,
 * and a fresh pool each time exhausts Postgres connections within a minute, so
 * the instance is parked on `globalThis`.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL не задан.");
  }
  return new PrismaClient({
    adapter: new PrismaPg(poolConfig(connectionString)),
  });
}

export const db: PrismaClient = globalForPrisma.prisma ?? create();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
