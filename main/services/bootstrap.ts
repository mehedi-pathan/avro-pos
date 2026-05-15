import bcrypt from "bcryptjs";
import { db } from "./database";

/** SQLite ADD COLUMN only allows constant defaults; CURRENT_TIMESTAMP is rejected. */
async function addColumnIfMissing(
  table: string,
  column: string,
  definition: string,
  backfillSql?: string
) {
  const prisma = db();
  const rows = (await prisma.$queryRawUnsafe(`PRAGMA table_info("${table}")`)) as Array<{ name: string }>;
  if (rows.some((row) => row.name === column)) {
    return;
  }

  let ddl = definition.trim();
  if (/\bDEFAULT\s+CURRENT_TIMESTAMP\b/i.test(ddl)) {
    ddl = ddl.replace(/\s*NOT\s+NULL\s+DEFAULT\s+CURRENT_TIMESTAMP\s*$/i, "").trim();
    if (!ddl) {
      ddl = "DATETIME";
    }
    await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${ddl};`);
    const fill =
      backfillSql ??
      `UPDATE "${table}" SET "${column}" = CURRENT_TIMESTAMP WHERE "${column}" IS NULL`;
    await prisma.$executeRawUnsafe(fill);
    return;
  }

  await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${ddl};`);
}

export async function ensureDatabaseSchema() {
  const prisma = db();

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "staffId" TEXT NOT NULL UNIQUE,
      "username" TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      "displayName" TEXT NOT NULL,
      "avatarUrl" TEXT,
      "role" TEXT NOT NULL DEFAULT 'SALESMAN',
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastLoginAt" DATETIME,
      "lastLoginIp" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await addColumnIfMissing("User", "staffId", "TEXT");
  await addColumnIfMissing("User", "displayName", "TEXT");
  await addColumnIfMissing("User", "avatarUrl", "TEXT");
  await addColumnIfMissing("User", "isActive", "BOOLEAN NOT NULL DEFAULT true");
  await addColumnIfMissing("User", "joinedAt", "DATETIME");
  await addColumnIfMissing("User", "lastLoginAt", "DATETIME");
  await addColumnIfMissing("User", "lastLoginIp", "TEXT");
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "User_staffId_key" ON "User" ("staffId");`);
  await prisma.$executeRawUnsafe(`UPDATE "User" SET "displayName" = "username" WHERE "displayName" IS NULL OR "displayName" = '';`);
  await prisma.$executeRawUnsafe(`UPDATE "User" SET "staffId" = 'AV-2026-001-OW' WHERE "staffId" IS NULL OR "staffId" = '';`);
  await prisma.$executeRawUnsafe(`UPDATE "User" SET "joinedAt" = CURRENT_TIMESTAMP WHERE "joinedAt" IS NULL;`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Customer" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "phone" TEXT NOT NULL UNIQUE,
      "email" TEXT,
      "address" TEXT,
      "points" INTEGER NOT NULL DEFAULT 0,
      "binNumber" TEXT,
      "tinNumber" TEXT,
      "membershipId" TEXT,
      "customerType" TEXT NOT NULL DEFAULT 'WALK_IN',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await addColumnIfMissing("Customer", "address", "TEXT");
  await addColumnIfMissing("Customer", "binNumber", "TEXT");
  await addColumnIfMissing("Customer", "tinNumber", "TEXT");
  await addColumnIfMissing("Customer", "membershipId", "TEXT");
  await addColumnIfMissing("Customer", "customerType", "TEXT NOT NULL DEFAULT 'WALK_IN'");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Product" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "sku" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "price" DECIMAL NOT NULL,
      "stockLevel" INTEGER NOT NULL DEFAULT 0,
      "lowStockAt" INTEGER NOT NULL DEFAULT 5,
      "category" TEXT,
      "barcodeSvg" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await addColumnIfMissing("Product", "lowStockAt", "INTEGER NOT NULL DEFAULT 5");
  await addColumnIfMissing("Product", "barcodeSvg", "TEXT");
  await addColumnIfMissing("Product", "subcategoryId", "TEXT");
  await addColumnIfMissing("Product", "purchasePrice", "DECIMAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("Product", "imagePath", "TEXT");
  await addColumnIfMissing("Product", "vatType", "TEXT NOT NULL DEFAULT 'EXCLUSIVE'");
  await addColumnIfMissing("Product", "vatRate", "DECIMAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("Product", "brand", "TEXT");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Sale" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "receiptNumber" TEXT UNIQUE,
      "invoiceUuid" TEXT UNIQUE,
      "invoiceFiscalYear" TEXT,
      "invoiceSequenceDate" TEXT,
      "branchId" TEXT,
      "branchName" TEXT,
      "terminalId" TEXT,
      "shiftNumber" TEXT,
      "sessionNumber" TEXT,
      "saleType" TEXT NOT NULL DEFAULT 'RETAIL',
      "status" TEXT NOT NULL DEFAULT 'PAID',
      "customerType" TEXT NOT NULL DEFAULT 'WALK_IN',
      "customerBinTin" TEXT,
      "customerMembershipId" TEXT,
      "paidAmount" DECIMAL NOT NULL DEFAULT 0,
      "changeAmount" DECIMAL NOT NULL DEFAULT 0,
      "dueAmount" DECIMAL NOT NULL DEFAULT 0,
      "mushakReference" TEXT,
      "cancellationReference" TEXT,
      "creditNoteReference" TEXT,
      "paymentMethod" TEXT,
      "paymentDetails" TEXT,
      "userId" TEXT,
      "customerId" TEXT,
      "subtotal" DECIMAL NOT NULL,
      "discount" DECIMAL NOT NULL DEFAULT 0,
      "tax" DECIMAL NOT NULL,
      "totalAmount" DECIMAL NOT NULL,
      "loyaltyPointsEarned" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);

  await addColumnIfMissing("Sale", "receiptNumber", "TEXT");
  await addColumnIfMissing("Sale", "invoiceUuid", "TEXT");
  await addColumnIfMissing("Sale", "invoiceFiscalYear", "TEXT");
  await addColumnIfMissing("Sale", "invoiceSequenceDate", "TEXT");
  await addColumnIfMissing("Sale", "branchId", "TEXT");
  await addColumnIfMissing("Sale", "branchName", "TEXT");
  await addColumnIfMissing("Sale", "terminalId", "TEXT");
  await addColumnIfMissing("Sale", "shiftNumber", "TEXT");
  await addColumnIfMissing("Sale", "sessionNumber", "TEXT");
  await addColumnIfMissing("Sale", "saleType", "TEXT NOT NULL DEFAULT 'RETAIL'");
  await addColumnIfMissing("Sale", "status", "TEXT NOT NULL DEFAULT 'PAID'");
  await addColumnIfMissing("Sale", "customerType", "TEXT NOT NULL DEFAULT 'WALK_IN'");
  await addColumnIfMissing("Sale", "customerBinTin", "TEXT");
  await addColumnIfMissing("Sale", "customerMembershipId", "TEXT");
  await addColumnIfMissing("Sale", "paidAmount", "DECIMAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("Sale", "changeAmount", "DECIMAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("Sale", "dueAmount", "DECIMAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("Sale", "mushakReference", "TEXT");
  await addColumnIfMissing("Sale", "cancellationReference", "TEXT");
  await addColumnIfMissing("Sale", "creditNoteReference", "TEXT");
  await addColumnIfMissing("Sale", "paymentDetails", "TEXT");
  await addColumnIfMissing("Sale", "customerId", "TEXT");
  await addColumnIfMissing("Sale", "discount", "DECIMAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("Sale", "loyaltyPointsEarned", "INTEGER NOT NULL DEFAULT 0");
  await addColumnIfMissing("Sale", "paymentMethod", "TEXT");
  await addColumnIfMissing(
    "Sale",
    "updatedAt",
    "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
    `UPDATE "Sale" SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL`
  );

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SaleItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "saleId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL,
      "unitPrice" DECIMAL NOT NULL,
      "lineSubtotal" DECIMAL NOT NULL,
      "lineTotal" DECIMAL NOT NULL,
      "productNameSnapshot" TEXT NOT NULL,
      "productSkuSnapshot" TEXT NOT NULL,
      "productBarcodeSnapshot" TEXT,
      "productUnit" TEXT,
      "productVariant" TEXT,
      "productBatch" TEXT,
      "productExpiry" TEXT,
      "productWarrantyId" TEXT,
      "itemDiscountAmount" DECIMAL NOT NULL DEFAULT 0,
      "vatRate" DECIMAL NOT NULL DEFAULT 0,
      "vatAmount" DECIMAL NOT NULL DEFAULT 0,
      "sdAmount" DECIMAL NOT NULL DEFAULT 0,
      "serviceChargeAmount" DECIMAL NOT NULL DEFAULT 0,
      CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );
  `);

  await addColumnIfMissing("SaleItem", "lineSubtotal", "DECIMAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("SaleItem", "productNameSnapshot", "TEXT");
  await addColumnIfMissing("SaleItem", "productSkuSnapshot", "TEXT");
  await addColumnIfMissing("SaleItem", "productBarcodeSnapshot", "TEXT");
  await addColumnIfMissing("SaleItem", "productUnit", "TEXT");
  await addColumnIfMissing("SaleItem", "productVariant", "TEXT");
  await addColumnIfMissing("SaleItem", "productBatch", "TEXT");
  await addColumnIfMissing("SaleItem", "productExpiry", "TEXT");
  await addColumnIfMissing("SaleItem", "productWarrantyId", "TEXT");
  await addColumnIfMissing("SaleItem", "itemDiscountAmount", "DECIMAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("SaleItem", "vatRate", "DECIMAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("SaleItem", "vatAmount", "DECIMAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("SaleItem", "sdAmount", "DECIMAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("SaleItem", "serviceChargeAmount", "DECIMAL NOT NULL DEFAULT 0");

  await prisma.$executeRawUnsafe(`
    UPDATE "SaleItem" SET "productNameSnapshot" = COALESCE(
      (SELECT "name" FROM "Product" WHERE "Product"."id" = "SaleItem"."productId"),
      ''
    ) WHERE "productNameSnapshot" IS NULL;
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "SaleItem" SET "productSkuSnapshot" = COALESCE(
      (SELECT "sku" FROM "Product" WHERE "Product"."id" = "SaleItem"."productId"),
      ''
    ) WHERE "productSkuSnapshot" IS NULL;
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SaleItem_saleId_idx" ON "SaleItem" ("saleId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SaleItem_productId_idx" ON "SaleItem" ("productId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Sale_customerId_idx" ON "Sale" ("customerId");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AuditLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "actorId" TEXT,
      "action" TEXT NOT NULL,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT,
      "description" TEXT NOT NULL,
      "metadata" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog" ("actorId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuditLog_entityType_idx" ON "AuditLog" ("entityType");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Setting" (
      "key" TEXT NOT NULL PRIMARY KEY,
      "value" TEXT NOT NULL,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const ownerCount = await prisma.user.count({ where: { role: "OWNER" } });
  if (ownerCount === 0) {
    await prisma.user.create({
      data: {
        staffId: "AV-2026-001-OW",
        username: "owner",
        displayName: "Owner",
        passwordHash: await bcrypt.hash("ChangeMe123!", 12),
        role: "OWNER"
      }
    });
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Category" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL UNIQUE,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Subcategory" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "categoryId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Subcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Subcategory_categoryId_idx" ON "Subcategory" ("categoryId");`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Subcategory_name_categoryId_key" ON "Subcategory" ("name", "categoryId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Product_subcategoryId_idx" ON "Product" ("subcategoryId");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Supplier" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "contactPerson" TEXT,
      "email" TEXT,
      "phone" TEXT,
      "address" TEXT,
      "notes" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Refund" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "saleId" TEXT NOT NULL,
      "reason" TEXT NOT NULL DEFAULT '',
      "totalRefund" DECIMAL NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Refund_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Refund_saleId_idx" ON "Refund" ("saleId");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SalePayment" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "saleId" TEXT NOT NULL,
      "method" TEXT NOT NULL,
      "amount" DECIMAL NOT NULL,
      "transactionId" TEXT,
      "gatewayReference" TEXT,
      "authorizationCode" TEXT,
      "status" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SalePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SalePayment_saleId_idx" ON "SalePayment" ("saleId");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "InvoiceSequence" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "branchId" TEXT NOT NULL,
      "branchName" TEXT NOT NULL,
      "fiscalYear" TEXT NOT NULL,
      "sequenceDate" TEXT NOT NULL,
      "counter" INTEGER NOT NULL DEFAULT 0,
      "backupUuid" TEXT NOT NULL DEFAULT (lower(hex(randomblob(16)))),
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceSequence_branch_fiscalDate_key" ON "InvoiceSequence" ("branchId", "fiscalYear", "sequenceDate");`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RefundItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "refundId" TEXT NOT NULL,
      "saleItemId" TEXT,
      "productId" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL,
      "unitPrice" DECIMAL NOT NULL,
      "lineTotal" DECIMAL NOT NULL,
      CONSTRAINT "RefundItem_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "RefundItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "RefundItem_refundId_idx" ON "RefundItem" ("refundId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "RefundItem_productId_idx" ON "RefundItem" ("productId");`);

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Expense" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "amount" DECIMAL NOT NULL,
        "category" TEXT NOT NULL,
        "description" TEXT,
        "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "userId" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Expense_date_idx" ON "Expense" ("date");`);
    console.log("Database schema initialized: Expense table ready.");
  } catch (err) {
    console.error("Database schema warning: Could not initialize Expense table.", err);
  }

  await prisma.setting.upsert({ where: { key: "businessName" }, create: { key: "businessName", value: "Avro POS" }, update: {} });
  await prisma.setting.upsert({ where: { key: "currencySymbol" }, create: { key: "currencySymbol", value: "৳" }, update: {} });
}
