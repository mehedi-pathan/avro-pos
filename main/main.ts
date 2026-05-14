import "dotenv/config";
import path from "node:path";
import { app, BrowserWindow, ipcMain, session } from "electron";
import { initDatabase } from "./services/database";
import { ensureDatabaseSchema } from "./services/bootstrap";
import { login } from "./services/auth";
import { bulkCreateProducts, deleteProduct, formatBarcodeLabel, getDashboardStats, getProducts, getSale, getSalesAnalytics, listSales, listRefunds, processReturn, processSale, upsertProduct } from "./services/pos";
import { syncToDrive } from "./services/gdrive";
import { authenticateWithGoogle, signOutFromGoogle, getGoogleDriveAuthStatus } from "./services/googleDriveAuth";
import { checkForUpdate, type UpdateInfo } from "./services/updater";
import { backupToDisk, getScheduledBackupStatus, startScheduledBackup, stopScheduledBackup } from "./services/localBackup";
import { createUser, generateUniqueID, listUsers, updateProfile } from "./services/iam";
import { deleteSupplier, listSuppliers, upsertSupplier } from "./services/supplier";
import { deleteCategory, deleteSubcategory, getCategoryDeleteInfo, listCategories, upsertCategory, upsertSubcategory } from "./services/category";
import { getSettings, updateSettings } from "./services/settings";
import { db } from "./services/database";
import { listCustomers, upsertCustomer } from "./services/crm";
import { generateBarcodeForProduct, getLowStockProducts, sendLowStockEmail } from "./services/inventoryIntelligence";
import { getAuditLogs } from "./services/audit";
import { heartbeat } from "./services/status";
import { formatThermalReceipt } from "./services/printer";

function createWindow() {
  const isDev = !app.isPackaged;
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: "Avro POS",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    win.loadURL("http://localhost:3000");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws://localhost:3000 http://localhost:3000 https://api.github.com; font-src 'self' data:;"
        ]
      }
    });
  });
}

function registerIpcHandlers() {
  ipcMain.handle("auth:login", async (event, payload: { username: string; password: string }) => {
    const ipAddress = event.sender.getURL().startsWith("http") ? "local-dev" : "local";
    return login(payload.username, payload.password, ipAddress);
  });

  ipcMain.handle("users:list", async () => listUsers());
  ipcMain.handle("users:create", async (_event, payload) => createUser(payload));
  ipcMain.handle("users:updateProfile", async (_event, payload) => updateProfile(payload));
  ipcMain.handle("users:generateUniqueId", async (_event, payload: { displayName: string; joinedAt?: string }) =>
    generateUniqueID(payload.displayName, payload.joinedAt)
  );

  ipcMain.handle("products:list", async () => getProducts());
  ipcMain.handle("products:upsert", async (_event, payload) => upsertProduct(payload));
  ipcMain.handle("products:delete", async (_event, id: string) => deleteProduct(id));
  ipcMain.handle("sales:process", async (_event, payload) => processSale(payload));
  ipcMain.handle("sales:list", async (_event, limit?: number) => listSales(limit));
  ipcMain.handle("sales:get", async (_event, id: string) => getSale(id));
  ipcMain.handle("sales:analytics", async () => getSalesAnalytics());
  ipcMain.handle("sales:dashboard", async () => getDashboardStats());
  ipcMain.handle("sales:return", async (_event, payload) => processReturn(payload));
  ipcMain.handle("sales:refunds", async (_event, saleId?: string) => listRefunds(saleId));
  ipcMain.handle("products:bulkCreate", async (_event, payload) => bulkCreateProducts(payload));

  ipcMain.handle("customers:list", async () => listCustomers());
  ipcMain.handle("customers:upsert", async (_event, payload) => upsertCustomer(payload));

  ipcMain.handle("settings:get", async () => getSettings());
  ipcMain.handle("settings:update", async (_event, payload) => updateSettings(payload));
  ipcMain.handle("audit:list", async (_event, payload?: { limit?: number }) => getAuditLogs(payload?.limit));
  ipcMain.handle("status:heartbeat", async () => heartbeat());
  ipcMain.handle("inventory:lowStock", async () => getLowStockProducts());
  ipcMain.handle("inventory:sendLowStockEmail", async () => sendLowStockEmail());
  ipcMain.handle("inventory:generateBarcode", async (_event, productId: string) => generateBarcodeForProduct(productId));
  ipcMain.handle("printer:formatReceipt", async (_event, payload) => formatThermalReceipt(payload));
  ipcMain.handle("printer:barcodeLabel", async (_event, payload) => formatBarcodeLabel(payload));

  ipcMain.handle("drive:auth", async () => authenticateWithGoogle());
  ipcMain.handle("drive:signOut", async () => signOutFromGoogle());
  ipcMain.handle("drive:status", async () => getGoogleDriveAuthStatus());

  ipcMain.handle("sync:drive", async () => {
    return syncToDrive();
  });

  ipcMain.handle("update:check", async () => checkForUpdate());

  ipcMain.handle("backup:disk", async () => backupToDisk());
  ipcMain.handle("backup:schedule", async (_event, payload: { intervalMs: number; targetFolder?: string }) => {
    await db().setting.upsert({ where: { key: "backupInterval" }, create: { key: "backupInterval", value: String(payload.intervalMs) }, update: { value: String(payload.intervalMs) } });
    if (payload.targetFolder) {
      await db().setting.upsert({ where: { key: "backupFolder" }, create: { key: "backupFolder", value: payload.targetFolder }, update: { value: payload.targetFolder } });
    }
    startScheduledBackup(payload.intervalMs, payload.targetFolder);
    return getScheduledBackupStatus();
  });
  ipcMain.handle("backup:stopSchedule", async () => {
    stopScheduledBackup();
    await db().setting.upsert({ where: { key: "backupInterval" }, create: { key: "backupInterval", value: "" }, update: { value: "" } });
    return getScheduledBackupStatus();
  });
  ipcMain.handle("backup:scheduleStatus", async () => getScheduledBackupStatus());

  ipcMain.handle("suppliers:list", async () => listSuppliers());
  ipcMain.handle("suppliers:upsert", async (_event, payload) => upsertSupplier(payload));
  ipcMain.handle("suppliers:delete", async (_event, id: string) => deleteSupplier(id));

  ipcMain.handle("categories:list", async () => listCategories());
  ipcMain.handle("categories:upsert", async (_event, payload) => upsertCategory(payload));
  ipcMain.handle("categories:delete", async (_event, id: string) => deleteCategory(id));
  ipcMain.handle("categories:deleteInfo", async (_event, id: string) => getCategoryDeleteInfo(id));
  ipcMain.handle("subcategories:upsert", async (_event, payload) => upsertSubcategory(payload));
  ipcMain.handle("subcategories:delete", async (_event, id: string) => deleteSubcategory(id));
}

app.whenReady().then(async () => {
  initDatabase();
  await ensureDatabaseSchema();
  registerIpcHandlers();
  createWindow();

  try {
    const allSettings = await db().setting.findMany();
    const smap = new Map(allSettings.map(r => [r.key, r.value]));
    const savedInterval = smap.get("backupInterval");
    if (savedInterval && !isNaN(Number(savedInterval))) {
      const savedFolder = smap.get("backupFolder") || undefined;
      startScheduledBackup(Number(savedInterval), savedFolder);
    }
  } catch { }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
