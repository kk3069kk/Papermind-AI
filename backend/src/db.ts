import { PrismaClient } from "@prisma/client";
import { settings } from "./config.js";

export const prisma = new PrismaClient({
  datasources: { db: { url: settings.databaseUrl } },
  log: settings.debug ? ["query", "error", "warn"] : ["error"],
});
