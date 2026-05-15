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
  binNumber?: string;
  tinNumber?: string;
  tradeLicenseNumber?: string;
  branchId?: string;
  branchName?: string;
  branchAddress?: string;
  verifiedPhone?: string;
  email?: string;
  website?: string;
  socialLinks?: string;
  mushakRegistration?: string;
  businessLogoPath?: string;
  currencySymbol: string;
  lowStockEmail: string;
  taxRate: string;
  lastCloudSyncAt: string | null;
};

export type PaymentDetail = {
  method: "cash" | "card" | "bkash" | "nagad" | "rocket" | "transfer" | "cheque";
  amount: number;
  transactionId?: string;
  gatewayReference?: string;
  authorizationCode?: string;
  status?: "PAID" | "PENDING" | "FAILED";
};

export type SaleType = "Retail" | "Wholesale" | "Online" | "Delivery";
export type CustomerType = "WALK_IN" | "REGISTERED" | "B2B";

export type LoginResult =
  | { ok: true; user: AuthUser }
  | { ok: false; error: string };

export type SalePayload = {
  userId?: string;
  actorId?: string;
  customerId?: string;
  terminalId?: string;
  branchId?: string;
  branchName?: string;
  shiftNumber?: string;
  sessionNumber?: string;
  saleType?: SaleType;
  customerType?: CustomerType;
  customerBinTin?: string;
  customerMembershipId?: string;
  taxRate?: number;
  discount?: number;
  paymentMethod?: string;
  paymentDetails?: PaymentDetail[];
  items: Array<{
    productId: string;
    quantity: number;
    discountAmount?: number;
    serialOrWarrantyId?: string;
    batchNumber?: string;
    expiryDate?: string;
    variant?: string;
  }>;
  customerDetails?: {
    name: string;
    phone: string;
    shopName: string;
    address: string;
    notes: string;
    membershipId?: string;
    binTin?: string;
  };
};

export type SaleItem = {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  product: { name: string; sku: string };
  productNameSnapshot?: string;
  productSkuSnapshot?: string;
  productBarcodeSnapshot?: string | null;
  productUnit?: string | null;
  productVariant?: string | null;
  productBatch?: string | null;
  productExpiry?: string | null;
  productWarrantyId?: string | null;
  itemDiscountAmount?: number;
  vatRate?: number;
  vatAmount?: number;
  sdAmount?: number;
  serviceChargeAmount?: number;
  lineSubtotal?: number;
};

export type SalePayment = {
  id: string;
  saleId: string;
  method: string;
  amount: number;
  transactionId?: string;
  gatewayReference?: string;
  authorizationCode?: string;
  status?: string;
  createdAt: string;
};

export type Sale = {
  id: string;
  receiptNumber: string | null;
  invoiceUuid?: string | null;
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
  paymentDetails?: PaymentDetail[];
  payments?: SalePayment[];
  terminalId?: string;
  branchId?: string;
  branchName?: string;
  shiftNumber?: string;
  sessionNumber?: string;
  saleType?: SaleType;
  customerType?: CustomerType;
  customerBinTin?: string | null;
  customerMembershipId?: string | null;
  paidAmount?: number;
  changeAmount?: number;
  dueAmount?: number;
  status?: string;
  mushakReference?: string | null;
  cancellationReference?: string | null;
  creditNoteReference?: string | null;
  createdAt: string;
  items: SaleItem[];
  /** Convenience: first payment gateway reference when present */
  transactionId?: string | null;
};

export type Expense = {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  date: string;
  userId: string | null;
  user?: { displayName: string } | null;
  createdAt: string;
};
