import type { BusinessSettings, Category, Customer, LoginResult, Product, Sale, SalePayload, StaffUser, Subcategory, Expense } from "./types";

export type AvroApi = {
  login: (username: string, password: string) => Promise<LoginResult>;
  listUsers: () => Promise<StaffUser[]>;
  createUser: (user: {
    actorId?: string;
    username: string;
    displayName: string;
    password: string;
    role: string;
    joinedAt?: string;
  }) => Promise<StaffUser>;
  updateProfile: (profile: {
    actorId: string;
    actorRole?: string;
    targetUserId: string;
    displayName?: string;
    avatarUrl?: string | null;
    password?: string;
    role?: string;
    isActive?: boolean;
  }) => Promise<StaffUser>;
  generateUniqueID: (displayName: string, joinedAt?: string) => Promise<string>;
  getProducts: () => Promise<Product[]>;
  upsertProduct: (
    product: Partial<Product> & Pick<Product, "sku" | "name" | "price" | "stockLevel"> & { actorId?: string; purchasePrice?: number; imagePath?: string | null; vatType?: "INCLUSIVE" | "EXCLUSIVE"; vatRate?: number; brand?: string | null }
  ) => Promise<Product>;
  deleteProduct: (id: string) => Promise<Product>;
  listCustomers: () => Promise<Customer[]>;
  upsertCustomer: (customer: { actorId?: string; id?: string; name: string; phone: string; email?: string | null }) => Promise<Customer>;
  processSale: (sale: SalePayload) => Promise<{ id: string }>;
  listSales: (limit?: number) => Promise<Sale[]>;
  getSale: (id: string) => Promise<Sale>;
  authenticateWithGoogle: () => Promise<{ email: string }>;
  signOutFromGoogle: () => Promise<void>;
  getGoogleDriveAuthStatus: () => Promise<{ authenticated: boolean; email?: string }>;
  syncToDrive: () => Promise<unknown>;
  backupToDisk: () => Promise<
    | { ok: true; folderPath: string; jsonPath: string; sqlitePath: string }
    | { ok: false; canceled: true }
  >;
  getSettings: () => Promise<BusinessSettings>;
  updateSettings: (settings: Partial<BusinessSettings> & { actorId?: string }) => Promise<BusinessSettings>;
  listAuditLogs: (limit?: number) => Promise<unknown[]>;
  heartbeat: () => Promise<{
    sqlite: string;
    latencyMs: number;
    dbPath: string;
    lastCloudSyncAt: string | null;
    lastBackupAt: string | null;
    totalProducts: number;
    totalCategories: number;
    todaySales: number;
    checkedAt: string;
  }>;
  getLowStockProducts: () => Promise<Product[]>;
  sendLowStockEmail: () => Promise<{ ok: true; count: number }>;
  scheduleBackup: (intervalMs: number, targetFolder?: string) => Promise<{ active: boolean }>;
  stopScheduledBackup: () => Promise<{ active: boolean }>;
  getBackupScheduleStatus: () => Promise<{ active: boolean }>;
  backupOnClose: () => Promise<{
    localBackup: { success: boolean; path: string };
    driveBackup: { success: boolean; message: string };
  }>;
  confirmClose: () => Promise<boolean>;
  onCloseRequest: (callback: (...args: unknown[]) => void) => () => void;
  generateBarcode: (productId: string) => Promise<{ productId: string; sku: string; barcodeSvg: string }>;
  formatReceipt: (payload: unknown) => Promise<string>;
  formatInvoiceA4: (payload: unknown) => Promise<string>;
  formatBarcodeLabel: (payload: unknown) => Promise<string>;
  processReturn: (payload: { actorId?: string; saleId: string; reason?: string; items: Array<{ saleItemId: string; productId: string; quantity: number; unitPrice: number }> }) => Promise<unknown>;
  listRefunds: (saleId?: string) => Promise<Array<unknown>>;
  listSuppliers: () => Promise<Array<{ id: string; name: string; contactPerson: string | null; email: string | null; phone: string | null; address: string | null; notes: string | null; createdAt: string; updatedAt: string }>>;
  upsertSupplier: (supplier: { actorId?: string; id?: string; name: string; contactPerson?: string; email?: string; phone?: string; address?: string; notes?: string }) => Promise<unknown>;
  deleteSupplier: (id: string) => Promise<unknown>;
  getSalesAnalytics: () => Promise<{
    todayRevenue: number;
    todayCount: number;
    todayExpenses: number;
    totalSales30d: number;
    revenue30d: number;
    expenses30d: number;
    dailyLabels: string[];
    dailyValues: number[];
    dailyExpenses: number[];
    topProducts: Array<{ name: string; total: number; count: number }>;
  }>;
  getDashboardStats: () => Promise<{
    todayRevenue: number;
    yesterdayRevenue: number;
    revenueChange: number;
    todayCount: number;
    yesterdayCount: number;
    orderChange: number;
    todayExpenses: number;
    totalItemsSold: number;
    newCustomers: number;
    hourlyData: Array<{ hour: string; revenue: number }>;
    topProducts: Array<{ productId: string; name: string; imagePath: string | null; unitsSold: number; revenue: number }>;
    lowStock: Array<{ id: string; name: string; sku: string; stockLevel: number; lowStockAt: number; imagePath: string | null }>;
    recentActivity: Array<{ id: string; type: "sale" | "inventory" | "expense" | "other"; description: string; amount: number | null; createdAt: string }>;
  }>;
  bulkCreateProducts: (products: Array<{ sku: string; name: string; price: number; stockLevel: number; lowStockAt?: number; category?: string }>) => Promise<{ created: number; skipped: number }>;
  listCategories: () => Promise<Category[]>;
  upsertCategory: (category: { id?: string; name: string }) => Promise<unknown>;
  deleteCategory: (id: string) => Promise<unknown>;
  getCategoryDeleteInfo: (id: string) => Promise<{
    id: string;
    name: string;
    subcategories: Array<{ id: string; name: string; productCount: number; totalStock: number; products: Array<{ name: string; stock: number }> }>;
    totalProducts: number;
    totalStock: number;
  }>;
  upsertSubcategory: (subcategory: { id?: string; name: string; categoryId: string }) => Promise<unknown>;
  deleteSubcategory: (id: string) => Promise<unknown>;
  checkForUpdate: () => Promise<{
    available: boolean;
    currentVersion: string;
    latestVersion: string;
    releaseUrl: string;
    releaseNotes: string;
    publishedAt: string;
    downloadUrl: string;
  } | null>;
  createExpense: (expense: { amount: number; category: string; description?: string; date?: string; userId?: string }) => Promise<Expense>;
  listExpenses: (filter?: { startDate?: string; endDate?: string }) => Promise<Expense[]>;
};

declare global {
  interface Window {
    api?: AvroApi;
  }
}

export function avroApi() {
  if (!window.api) {
    throw new Error("Avro POS desktop API is unavailable. Run the app through Electron.");
  }

  return window.api;
}
