import path from "node:path";
import { app } from "electron";
import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

export function getDatabasePath() {
  return path.join(app.getPath("userData"), "pos.db");
}

export function initDatabase() {
  const dbPath = getDatabasePath();
  process.env.DATABASE_URL = `file:${dbPath}`;

  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
    });
  }

  return prisma;
}

export function db() {
  return prisma ?? initDatabase();
}
