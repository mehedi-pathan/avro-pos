import { db, getDatabasePath } from "./database";
import { getSettings } from "./settings";

export async function heartbeat() {
  const started = Date.now();
  await db().$queryRaw`SELECT 1`;
  const settings = await getSettings();
  const lastBackupAt = (await db().setting.findUnique({ where: { key: "lastBackupAt" } }))?.value ?? null;
  const totalProducts = await db().product.count();
  const totalCategories = await db().category.count();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todaySales = await db().sale.count({ where: { createdAt: { gte: todayStart } } });

  return {
    sqlite: "online",
    latencyMs: Date.now() - started,
    dbPath: getDatabasePath(),
    lastCloudSyncAt: settings.lastCloudSyncAt,
    lastBackupAt,
    totalProducts,
    totalCategories,
    todaySales,
    checkedAt: new Date().toISOString()
  };
}
