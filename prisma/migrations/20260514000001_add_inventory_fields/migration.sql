-- AlterTable: Add inventory management fields to Product
ALTER TABLE "Product" ADD COLUMN "purchasePrice" DECIMAL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "imagePath" TEXT;
ALTER TABLE "Product" ADD COLUMN "vatType" TEXT DEFAULT 'EXCLUSIVE';
ALTER TABLE "Product" ADD COLUMN "vatRate" DECIMAL DEFAULT 0;
