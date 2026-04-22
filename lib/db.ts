/**
 * Singleton Prisma client. Next dev mode reloads modules on every request,
 * so we attach the client to globalThis to avoid exhausting connections.
 */
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;
