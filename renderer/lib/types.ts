export type Role = "OWNER" | "MANAGER" | "SALESMAN";
export type Capability =
  | "CHECKOUT"
  | "INVENTORY_READ"
  | "INVENTORY_WRITE"
  | "REPORTS"
  | "TEAM_MANAGE"
  | "DELETE_RECORDS"
  | "CLOUD_SYNC"
  | "SETTINGS";

export const capabilityMap: Record<Role, Capability[]> = {
  SALESMAN: ["CHECKOUT"],
  MANAGER: ["CHECKOUT", "INVENTORY_READ", "INVENTORY_WRITE", "REPORTS"],
  OWNER: ["CHECKOUT", "INVENTORY_READ", "INVENTORY_WRITE", "REPORTS", "TEAM_MANAGE", "DELETE_RECORDS", "CLOUD_SYNC", "SETTINGS"]
};

export type SubcategorySummary = {
  id: string;
  name: string;
  category: { id: string; name: string };
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  price: number;
  purchasePrice: number;
  stockLevel: number;
  lowStockAt: number;
  category: string | null;
  subcategoryId?: string | null;
  subcategory?: SubcategorySummary | null;
  barcodeSvg?: string | null;
  imagePath?: string | null;
  vatType: "INCLUSIVE" | "EXCLUSIVE";
  vatRate: number;
  brand: string | null;
};

export type Category = {
  id: string;
  name: string;
  subcategories: (Subcategory & { _count?: { products: number } })[];
};

export type Subcategory = {
  id: string;
  name: string;
  categoryId: string;
};

export type AuthUser = {
  id: string;
  staffId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  role: Role;
};

export type StaffUser = AuthUser & {
  isActive: boolean;
  joinedAt: string;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  points: number;
  isVip?: boolean;
};

export type BusinessSettings = {
  businessName: string;
  address: string;
  taxId: string;
  currencySymbol: string;
  lowStockEmail: string;
  taxRate: string;
  lastCloudSyncAt: string | null;
};

export type LoginResult =
  | { ok: true; user: AuthUser }
  | { ok: false; error: string };

export type SalePayload = {
  userId?: string;
  actorId?: string;
  customerId?: string;
  taxRate?: number;
  discount?: number;
  paymentMethod?: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
};

export type SaleItem = {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  product: { name: string; sku: string };
};

export type Sale = {
  id: string;
  receiptNumber: string | null;
  userId: string | null;
  user: { id: string; staffId: string; displayName: string; username: string } | null;
  customerId: string | null;
  customer: { id: string; name: string; phone: string } | null;
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  loyaltyPointsEarned: number;
  paymentMethod: string | null;
  items: SaleItem[];
  createdAt: string;
};
