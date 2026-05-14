import bcrypt from "bcryptjs";
import { db } from "./database";

async function addColumnIfMissing(table: string, column: string, definition: string) {
  const prisma = db();
  const rows = (await prisma.$queryRawUnsafe(`PRAGMA table_info("${table}")`)) as Array<{ name: string }>;
  if (!rows.some((row) => row.name === column)) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition};`);
  }
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
      "points" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

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

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Sale" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT,
      "customerId" TEXT,
      "subtotal" DECIMAL NOT NULL,
      "discount" DECIMAL NOT NULL DEFAULT 0,
      "tax" DECIMAL NOT NULL,
      "totalAmount" DECIMAL NOT NULL,
      "loyaltyPointsEarned" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);

  await addColumnIfMissing("Sale", "customerId", "TEXT");
  await addColumnIfMissing("Sale", "discount", "DECIMAL NOT NULL DEFAULT 0");
  await addColumnIfMissing("Sale", "loyaltyPointsEarned", "INTEGER NOT NULL DEFAULT 0");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SaleItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "saleId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL,
      "unitPrice" DECIMAL NOT NULL,
      "lineTotal" DECIMAL NOT NULL,
      CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );
  `);

  await addColumnIfMissing("Sale", "receiptNumber", "TEXT");
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

  await prisma.setting.upsert({ where: { key: "businessName" }, create: { key: "businessName", value: "Avro POS" }, update: {} });
  await prisma.setting.upsert({ where: { key: "currencySymbol" }, create: { key: "currencySymbol", value: "৳" }, update: {} });
}
