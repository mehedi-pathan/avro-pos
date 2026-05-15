import fs from "node:fs/promises";
import path from "node:path";
import { app, dialog } from "electron";
import { db, getDatabasePath } from "./database";

function backupStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export async function writeBackupTo(folder: string) {
  const backupFolder = path.join(folder, `avro-pos-backup-${backupStamp()}`);
  await fs.mkdir(backupFolder, { recursive: true });

  const [users, customers, products, sales, auditLogs, settings] = await Promise.all([
    db().user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { username: "asc" }
    }),
    db().customer.findMany({ orderBy: { name: "asc" } }),
    db().product.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    db().sale.findMany({ include: { items: true, customer: true }, orderBy: { createdAt: "desc" } }),
    db().auditLog.findMany({ orderBy: { createdAt: "desc" } }),
    db().setting.findMany()
  ]);

  const jsonPath = path.join(backupFolder, "avro_pos_backup.json");
  const sqlitePath = path.join(backupFolder, "pos.db");

  await fs.writeFile(
    jsonPath,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        sourceDatabase: getDatabasePath(),
        users,
        customers,
        products,
        sales,
        auditLogs,
        settings
      },
      null,
      2
    ),
    "utf8"
  );

  await fs.copyFile(getDatabasePath(), sqlitePath);

  return { folderPath: backupFolder, jsonPath, sqlitePath };
}

export async function backupToDisk() {
  const result = await dialog.showOpenDialog({
    title: "Choose backup folder",
    properties: ["openDirectory", "createDirectory"]
  });

  if (result.canceled || !result.filePaths[0]) {
    return { ok: false as const, canceled: true as const };
  }

  const resultPaths = await writeBackupTo(result.filePaths[0]);
  await db().setting.upsert({
    where: { key: "lastBackupAt" },
    create: { key: "lastBackupAt", value: new Date().toISOString() },
    update: { value: new Date().toISOString() }
  });
  return { ok: true as const, ...resultPaths };
}

let scheduledBackupTimer: ReturnType<typeof setInterval> | null = null;

export function startScheduledBackup(intervalMs: number, targetFolder?: string) {
  stopScheduledBackup();
  const folder = targetFolder || app.getPath("documents");
  scheduledBackupTimer = setInterval(async () => {
    try {
      await writeBackupTo(folder);
      await db().setting.upsert({
        where: { key: "lastBackupAt" },
        create: { key: "lastBackupAt", value: new Date().toISOString() },
        update: { value: new Date().toISOString() }
      });
    } catch {
      // silent failure for auto-backup
    }
  }, intervalMs);
}

export function stopScheduledBackup() {
  if (scheduledBackupTimer) {
    clearInterval(scheduledBackupTimer);
    scheduledBackupTimer = null;
  }
}

export function getScheduledBackupStatus() {
  return { active: scheduledBackupTimer !== null };
}
