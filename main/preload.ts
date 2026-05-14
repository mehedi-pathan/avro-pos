import { contextBridge, ipcRenderer } from "electron";

const api = {
  login: (username: string, password: string) => ipcRenderer.invoke("auth:login", { username, password }),
  listUsers: () => ipcRenderer.invoke("users:list"),
  createUser: (user: unknown) => ipcRenderer.invoke("users:create", user),
  updateProfile: (profile: unknown) => ipcRenderer.invoke("users:updateProfile", profile),
  generateUniqueID: (displayName: string, joinedAt?: string) =>
    ipcRenderer.invoke("users:generateUniqueId", { displayName, joinedAt }),
  getProducts: () => ipcRenderer.invoke("products:list"),
  upsertProduct: (product: unknown) => ipcRenderer.invoke("products:upsert", product),
  deleteProduct: (id: string) => ipcRenderer.invoke("products:delete", id),
  listCustomers: () => ipcRenderer.invoke("customers:list"),
  upsertCustomer: (customer: unknown) => ipcRenderer.invoke("customers:upsert", customer),
  processSale: (sale: unknown) => ipcRenderer.invoke("sales:process", sale),
  listSales: (limit?: number) => ipcRenderer.invoke("sales:list", limit),
  getSale: (id: string) => ipcRenderer.invoke("sales:get", id),
  authenticateWithGoogle: () => ipcRenderer.invoke("drive:auth"),
  signOutFromGoogle: () => ipcRenderer.invoke("drive:signOut"),
  getGoogleDriveAuthStatus: () => ipcRenderer.invoke("drive:status"),
  syncToDrive: () => ipcRenderer.invoke("sync:drive"),
  backupToDisk: () => ipcRenderer.invoke("backup:disk"),
  scheduleBackup: (intervalMs: number, targetFolder?: string) => ipcRenderer.invoke("backup:schedule", { intervalMs, targetFolder }),
  stopScheduledBackup: () => ipcRenderer.invoke("backup:stopSchedule"),
  getBackupScheduleStatus: () => ipcRenderer.invoke("backup:scheduleStatus"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  updateSettings: (settings: unknown) => ipcRenderer.invoke("settings:update", settings),
  listAuditLogs: (limit?: number) => ipcRenderer.invoke("audit:list", { limit }),
  heartbeat: () => ipcRenderer.invoke("status:heartbeat"),
  getLowStockProducts: () => ipcRenderer.invoke("inventory:lowStock"),
  sendLowStockEmail: () => ipcRenderer.invoke("inventory:sendLowStockEmail"),
  generateBarcode: (productId: string) => ipcRenderer.invoke("inventory:generateBarcode", productId),
  formatReceipt: (payload: unknown) => ipcRenderer.invoke("printer:formatReceipt", payload),
  formatBarcodeLabel: (payload: unknown) => ipcRenderer.invoke("printer:barcodeLabel", payload),
  processReturn: (payload: unknown) => ipcRenderer.invoke("sales:return", payload),
  listRefunds: (saleId?: string) => ipcRenderer.invoke("sales:refunds", saleId),
  getSalesAnalytics: () => ipcRenderer.invoke("sales:analytics"),
  getDashboardStats: () => ipcRenderer.invoke("sales:dashboard"),
  bulkCreateProducts: (products: unknown) => ipcRenderer.invoke("products:bulkCreate", products),
  listSuppliers: () => ipcRenderer.invoke("suppliers:list"),
  upsertSupplier: (supplier: unknown) => ipcRenderer.invoke("suppliers:upsert", supplier),
  deleteSupplier: (id: string) => ipcRenderer.invoke("suppliers:delete", id),
  listCategories: () => ipcRenderer.invoke("categories:list"),
  upsertCategory: (category: { id?: string; name: string }) => ipcRenderer.invoke("categories:upsert", category),
  deleteCategory: (id: string) => ipcRenderer.invoke("categories:delete", id),
  getCategoryDeleteInfo: (id: string) => ipcRenderer.invoke("categories:deleteInfo", id),
  upsertSubcategory: (subcategory: { id?: string; name: string; categoryId: string }) => ipcRenderer.invoke("subcategories:upsert", subcategory),
  deleteSubcategory: (id: string) => ipcRenderer.invoke("subcategories:delete", id),
  checkForUpdate: () => ipcRenderer.invoke("update:check")
};

contextBridge.exposeInMainWorld("api", api);

export type AvroApi = typeof api;
