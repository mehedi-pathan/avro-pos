import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { db } from "./database";
import { auditLog } from "./audit";
import { getSettings, type BusinessSettings } from "./settings";
import { randomUUID } from "crypto";
import QRCode from "qrcode";

export type SaleInput = {
  userId?: string;
  actorId?: string;
  customerId?: string;
  terminalId?: string;
  branchId?: string;
  branchName?: string;
  shiftNumber?: string;
  sessionNumber?: string;
  saleType?: "Retail" | "Wholesale" | "Online" | "Delivery";
  customerType?: "WALK_IN" | "REGISTERED" | "B2B";
  customerBinTin?: string;
  customerMembershipId?: string;
  taxRate?: number;
  discount?: number;
  paymentMethod?: string;
  paymentDetails?: Array<{
    method: "cash" | "card" | "bkash" | "nagad" | "rocket" | "transfer" | "cheque";
    amount: number;
    transactionId?: string;
    gatewayReference?: string;
    authorizationCode?: string;
    status?: "PAID" | "PENDING" | "FAILED";
  }>;
  items: Array<{
    productId: string;
    quantity: number;
    discountAmount?: number;
    serialOrWarrantyId?: string;
    batchNumber?: string;
    expiryDate?: string;
    variant?: string;
  }>;
};

function serializeProduct<T extends { price: Prisma.Decimal; purchasePrice: Prisma.Decimal; vatRate: Prisma.Decimal; createdAt: Date; updatedAt: Date }>(product: T) {
  return {
    ...product,
    price: Number(product.price),
    purchasePrice: Number(product.purchasePrice),
    vatRate: Number(product.vatRate),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString()
  };
}

export async function getProducts() {
  const products = await db().product.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { subcategory: { include: { category: true } } }
  });
  return products.map((p) => ({ ...serializeProduct(p), subcategory: p.subcategory ? { id: p.subcategory.id, name: p.subcategory.name, category: { id: p.subcategory.category.id, name: p.subcategory.category.name } } : null }));
}

export async function upsertProduct(input: {
  actorId?: string;
  id?: string;
  sku: string;
  name: string;
  price: number;
  purchasePrice?: number;
  stockLevel: number;
  lowStockAt?: number;
  category?: string | null;
  subcategoryId?: string | null;
  imagePath?: string | null;
  vatType?: "INCLUSIVE" | "EXCLUSIVE";
  vatRate?: number;
  brand?: string | null;
}) {
  const data = {
    sku: input.sku,
    name: input.name,
    price: new Prisma.Decimal(input.price),
    purchasePrice: new Prisma.Decimal(input.purchasePrice ?? 0),
    stockLevel: input.stockLevel,
    lowStockAt: input.lowStockAt ?? 5,
    category: input.category || null,
    subcategoryId: input.subcategoryId || null,
    imagePath: input.imagePath ?? null,
    vatType: input.vatType ?? "EXCLUSIVE",
    vatRate: new Prisma.Decimal(input.vatRate ?? 0),
    brand: input.brand ?? null,
  } as Prisma.ProductUncheckedCreateInput;

  if (input.id) {
    const previous = await db().product.findUnique({ where: { id: input.id } });
    if (!previous) throw new Error(`Product ${input.id} not found.`);

    const product = await db().product.update({ where: { id: input.id }, data });

    const changes: string[] = [];
    if (Number(previous.price) !== input.price) changes.push(`price from ${Number(previous.price)} to ${input.price}`);
    if (previous.stockLevel !== input.stockLevel) changes.push(`stock from ${previous.stockLevel} to ${input.stockLevel}`);
    if (previous.name !== input.name) changes.push(`name from "${previous.name}" to "${input.name}"`);
    if (changes.length > 0) {
      await auditLog({
        actorId: input.actorId,
        action: "PRODUCT_UPDATED",
        entityType: "Product",
        entityId: product.id,
        description: `Updated product ${product.sku}: ${changes.join("; ")}.`,
      });
    }

    return serializeProduct(product);
  }

  const product = await db().product.create({ data });
  await auditLog({
    actorId: input.actorId,
    action: "PRODUCT_CREATED",
    entityType: "Product",
    entityId: product.id,
    description: `Created product ${product.sku} (${product.name}).`,
  });
  return serializeProduct(product);
}

export async function deleteProduct(id: string) {
  const product = await db().product.delete({ where: { id } });
  return serializeProduct(product);
}

export function formatBarcodeLabel(product: {
  name: string;
  sku: string;
  price: number;
  barcodeSvg?: string | null;
  currencySymbol?: string;
}) {
  const sym = product.currencySymbol === "৳" ? "TK" : (product.currencySymbol ?? "TK");
  const svg = product.barcodeSvg ?? "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Barcode Label</title>
<style>
  @page { size: 50mm 25mm; margin: 0; }
  body { margin: 0; padding: 2mm; font-family: 'Courier New', monospace; width: 46mm; height: 21mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; overflow: hidden; }
  .sku { font-size: 7px; letter-spacing: 0.5px; color: #333; margin-bottom: 1px; }
  .name { font-size: 8px; font-weight: bold; color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 46mm; margin-bottom: 1px; }
  .price { font-size: 10px; font-weight: bold; color: #000; margin-bottom: 1px; }
  .barcode svg { width: 44mm; height: 10mm; display: block; }
</style></head><body>
  <div class="sku">${product.sku}</div>
  <div class="name">${product.name}</div>
  <div class="price">${sym}${product.price.toFixed(2)}</div>
  ${svg ? `<div class="barcode">${svg}</div>` : ""}
  <script>window.print();<\/script>
</body></html>`;
}

function getBangladeshFiscalYear(date: Date) {
  return date.getMonth() >= 6 ? date.getFullYear() + 1 : date.getFullYear();
}

function normalizeBranchId(branch?: string) {
  return (branch?.trim() || "MAIN")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type DbTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

async function getInvoiceSequence(
  tx: DbTransaction,
  branchId: string,
  branchName: string,
  fiscalYear: string,
  sequenceDate: string
) {
  const sequence = await tx.invoiceSequence.findUnique({
    where: { branchId_fiscalYear_sequenceDate: { branchId, fiscalYear, sequenceDate } }
  });

  if (sequence) {
    return tx.invoiceSequence.update({
      where: { id: sequence.id },
      data: { counter: { increment: 1 } }
    });
  }

  return tx.invoiceSequence.create({
    data: {
      branchId,
      branchName,
      fiscalYear,
      sequenceDate,
      counter: 1,
      backupUuid: randomUUID()
    }
  });
}

export async function processSale(input: SaleInput) {
  if (!input.items.length) {
    throw new Error("Cannot process an empty sale.");
  }

  return db().$transaction(async (tx) => {
    const productIds = input.items.map((item) => item.productId);
    const products = await tx.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((product) => [product.id, product]));

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }
      if (product.stockLevel < item.quantity) {
        throw new Error(`${product.name} only has ${product.stockLevel} in stock.`);
      }
    }

    const settings = await getSettings();
    const branchName = input.branchName?.trim() || settings.branchName || "MAIN";
    const branchId = normalizeBranchId(input.branchId || settings.branchId || branchName);
    const now = new Date();
    const fiscalYear = String(getBangladeshFiscalYear(now));
    const sequenceDate = now.toISOString().slice(0, 10);
    const sequence = await getInvoiceSequence(tx, branchId, branchName, fiscalYear, sequenceDate);
    const receiptNumber = `INV-${fiscalYear}-${branchId}-${String(sequence.counter).padStart(6, "0")}`;
    const invoiceUuid = randomUUID();

    const saleItems = input.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      const unitPrice = new Prisma.Decimal(product.price);
      const discountAmount = new Prisma.Decimal(item.discountAmount ?? 0);
      const vatRate = new Prisma.Decimal(product.vatRate ?? 0);
      const quantity = new Prisma.Decimal(item.quantity);
      const netUnitPrice = vatRate.greaterThan(0) && product.vatType === "INCLUSIVE"
        ? unitPrice.div(vatRate.div(100).add(1))
        : unitPrice;
      const lineBase = netUnitPrice.mul(quantity);
      const vatAmount = vatRate.greaterThan(0)
        ? product.vatType === "INCLUSIVE"
          ? unitPrice.sub(netUnitPrice).mul(quantity)
          : lineBase.mul(vatRate.div(100))
        : new Prisma.Decimal(0);
      const sdAmount = new Prisma.Decimal(0);
      const serviceChargeAmount = new Prisma.Decimal(0);
      const lineSubtotal = lineBase.sub(discountAmount);
      if (lineSubtotal.lessThan(0)) {
        throw new Error(`Item discount exceeds net price for ${product.name}.`);
      }
      const lineTotal = lineSubtotal.add(vatAmount).add(sdAmount).add(serviceChargeAmount);

      return {
        saleId: "",
        productId: product.id,
        quantity: item.quantity,
        unitPrice,
        lineSubtotal,
        lineTotal,
        productNameSnapshot: product.name,
        productSkuSnapshot: product.sku,
        productBarcodeSnapshot: product.sku,
        productUnit: "Pcs",
        productVariant: item.variant ?? null,
        productBatch: item.batchNumber ?? null,
        productExpiry: item.expiryDate ?? null,
        productWarrantyId: item.serialOrWarrantyId ?? null,
        itemDiscountAmount: discountAmount,
        vatRate,
        vatAmount,
        sdAmount,
        serviceChargeAmount,
      };
    });

    const netSubtotal = saleItems.reduce((sum, item) => sum.add(item.lineSubtotal), new Prisma.Decimal(0));
    const totalVat = saleItems.reduce((sum, item) => sum.add(item.vatAmount), new Prisma.Decimal(0));
    const totalSd = saleItems.reduce((sum, item) => sum.add(item.sdAmount), new Prisma.Decimal(0));
    const totalService = saleItems.reduce((sum, item) => sum.add(item.serviceChargeAmount), new Prisma.Decimal(0));
    const discount = new Prisma.Decimal(input.discount ?? 0);
    if (discount.lessThan(0)) {
      throw new Error("Invoice discount cannot be negative.");
    }

    const adjustedSubtotal = netSubtotal.sub(discount);
    if (adjustedSubtotal.lessThan(0)) {
      throw new Error("Invoice discount exceeds subtotal.");
    }

    const totalAmount = adjustedSubtotal.add(totalVat).add(totalSd).add(totalService);
    if (totalAmount.lessThan(0)) {
      throw new Error("Total invoice amount cannot be negative.");
    }

    const paymentsInput: Array<{
      method: string;
      amount: number;
      transactionId?: string;
      gatewayReference?: string;
      authorizationCode?: string;
      status?: string;
    }> =
      input.paymentDetails && input.paymentDetails.length > 0
        ? input.paymentDetails.map((p) => ({
            method: p.method,
            amount: p.amount,
            transactionId: p.transactionId,
            gatewayReference: p.gatewayReference,
            authorizationCode: p.authorizationCode,
            status: p.status
          }))
        : [
            {
              method: input.paymentMethod ?? "cash",
              amount: Number(totalAmount),
              status: "PAID"
            }
          ];

    const paidAmount = paymentsInput.reduce((sum, payment) => sum.add(new Prisma.Decimal(payment.amount)), new Prisma.Decimal(0));
    const changeAmount = paidAmount.greaterThan(totalAmount) ? paidAmount.sub(totalAmount) : new Prisma.Decimal(0);
    const dueAmount = paidAmount.lessThan(totalAmount) ? totalAmount.sub(paidAmount) : new Prisma.Decimal(0);
    const status = dueAmount.greaterThan(0) ? "PARTIAL" : "PAID";

    const sale = await tx.sale.create({
      data: {
        receiptNumber,
        invoiceUuid,
        invoiceFiscalYear: fiscalYear,
        invoiceSequenceDate: sequenceDate,
        branchId,
        branchName,
        terminalId: input.terminalId ?? null,
        shiftNumber: input.shiftNumber ?? null,
        sessionNumber: input.sessionNumber ?? null,
        saleType: (input.saleType ?? "Retail").toUpperCase(),
        status,
        customerType: input.customerType ?? (input.customerBinTin ? "B2B" : input.customerId ? "REGISTERED" : "WALK_IN"),
        customerBinTin: input.customerBinTin ?? null,
        customerMembershipId: input.customerMembershipId ?? null,
        paidAmount,
        changeAmount,
        dueAmount,
        paymentMethod: input.paymentMethod ?? paymentsInput[0].method,
        paymentDetails: paymentsInput.length > 0 ? JSON.stringify(paymentsInput) : null,
        userId: input.userId ?? null,
        customerId: input.customerId ?? null,
        subtotal: netSubtotal,
        discount,
        tax: totalVat,
        totalAmount,
        loyaltyPointsEarned: Number(totalAmount.toFixed(0)),
        items: {
          create: saleItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineSubtotal: item.lineSubtotal,
            lineTotal: item.lineTotal,
            productNameSnapshot: item.productNameSnapshot,
            productSkuSnapshot: item.productSkuSnapshot,
            productBarcodeSnapshot: item.productBarcodeSnapshot,
            productUnit: item.productUnit,
            productVariant: item.productVariant,
            productBatch: item.productBatch,
            productExpiry: item.productExpiry,
            productWarrantyId: item.productWarrantyId,
            itemDiscountAmount: item.itemDiscountAmount,
            vatRate: item.vatRate,
            vatAmount: item.vatAmount,
            sdAmount: item.sdAmount,
            serviceChargeAmount: item.serviceChargeAmount,
          }))
        },
        payments: {
          create: paymentsInput.map((payment) => ({
            method: payment.method,
            amount: new Prisma.Decimal(payment.amount),
            transactionId: payment.transactionId ?? null,
            gatewayReference: payment.gatewayReference ?? null,
            authorizationCode: payment.authorizationCode ?? null,
            status: payment.status ?? null
          }))
        }
      },
      include: { items: true, payments: true }
    });

    for (const item of input.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stockLevel: { decrement: item.quantity } }
      });
    }

    if (input.customerId) {
      await tx.customer.update({
        where: { id: input.customerId },
        data: { points: { increment: Number(totalAmount.toFixed(0)) } }
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: input.actorId ?? input.userId ?? null,
        action: "SALE_COMPLETED",
        entityType: "Sale",
        entityId: sale.id,
        description: `Completed sale ${sale.id} totaling ${Number(totalAmount)}.`,
        metadata: JSON.stringify({
          customerId: input.customerId ?? null,
          branchId,
          terminalId: input.terminalId ?? null,
          saleType: input.saleType ?? "Retail",
          discount: Number(discount),
          paymentMethod: input.paymentMethod ?? paymentsInput[0].method
        })
      }
    });

    return {
      id: sale.id,
      receiptNumber: sale.receiptNumber,
      invoiceUuid: sale.invoiceUuid,
      userId: sale.userId,
      customerId: sale.customerId,
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      tax: Number(sale.tax),
      totalAmount: Number(sale.totalAmount),
      loyaltyPointsEarned: sale.loyaltyPointsEarned,
      paymentMethod: sale.paymentMethod,
      payments: sale.payments.map((payment) => ({
        id: payment.id,
        saleId: payment.saleId,
        method: payment.method,
        amount: Number(payment.amount),
        transactionId: payment.transactionId,
        gatewayReference: payment.gatewayReference,
        authorizationCode: payment.authorizationCode,
        status: payment.status,
        createdAt: payment.createdAt.toISOString()
      })),
      terminalId: sale.terminalId,
      branchId: sale.branchId,
      branchName: sale.branchName,
      shiftNumber: sale.shiftNumber,
      sessionNumber: sale.sessionNumber,
      saleType: sale.saleType as "Retail" | "Wholesale" | "Online" | "Delivery",
      customerType: sale.customerType as "WALK_IN" | "REGISTERED" | "B2B",
      customerBinTin: sale.customerBinTin,
      customerMembershipId: sale.customerMembershipId,
      paidAmount: Number(sale.paidAmount),
      changeAmount: Number(sale.changeAmount),
      dueAmount: Number(sale.dueAmount),
      status: sale.status,
      createdAt: sale.createdAt.toISOString(),
      items: sale.items.map((item) => ({
        id: item.id,
        saleId: item.saleId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
        product: { name: item.productNameSnapshot, sku: item.productSkuSnapshot },
        productNameSnapshot: item.productNameSnapshot,
        productSkuSnapshot: item.productSkuSnapshot,
        productBarcodeSnapshot: item.productBarcodeSnapshot,
        productUnit: item.productUnit,
        productVariant: item.productVariant,
        productBatch: item.productBatch,
        productExpiry: item.productExpiry,
        productWarrantyId: item.productWarrantyId,
        itemDiscountAmount: Number(item.itemDiscountAmount),
        vatRate: Number(item.vatRate),
        vatAmount: Number(item.vatAmount),
        sdAmount: Number(item.sdAmount),
        serviceChargeAmount: Number(item.serviceChargeAmount),
        lineSubtotal: Number(item.lineSubtotal)
      }))
    };
  });
}

function serializeSale(sale: {
  id: string;
  receiptNumber: string | null;
  invoiceUuid?: string | null;
  terminalId?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  shiftNumber?: string | null;
  sessionNumber?: string | null;
  saleType?: string | null;
  customerType?: string | null;
  customerBinTin?: string | null;
  customerMembershipId?: string | null;
  paidAmount?: Prisma.Decimal;
  changeAmount?: Prisma.Decimal;
  dueAmount?: Prisma.Decimal;
  status?: string | null;
  userId: string | null;
  user?: { id: string; staffId: string; displayName: string; username: string } | null;
  customerId: string | null;
  customer?: { id: string; name: string; phone: string } | null;
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  tax: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  loyaltyPointsEarned: number;
  paymentMethod: string | null;
  payments?: Array<{
    id: string;
    saleId: string;
    method: string;
    amount: Prisma.Decimal;
    transactionId?: string | null;
    gatewayReference?: string | null;
    authorizationCode?: string | null;
    status?: string | null;
    createdAt: Date;
  }>;
  createdAt: Date;
  items: Array<{
    id: string;
    saleId: string;
    productId: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
    lineSubtotal: Prisma.Decimal;
    productNameSnapshot: string;
    productSkuSnapshot: string;
    productBarcodeSnapshot?: string | null;
    productUnit?: string | null;
    productVariant?: string | null;
    productBatch?: string | null;
    productExpiry?: string | null;
    productWarrantyId?: string | null;
    itemDiscountAmount: Prisma.Decimal;
    vatRate: Prisma.Decimal;
    vatAmount: Prisma.Decimal;
    sdAmount: Prisma.Decimal;
    serviceChargeAmount: Prisma.Decimal;
    product?: { name: string; sku: string };
  }>;
}) {
  return {
    id: sale.id,
    receiptNumber: sale.receiptNumber,
    invoiceUuid: sale.invoiceUuid ?? null,
    terminalId: sale.terminalId ?? null,
    branchId: sale.branchId ?? null,
    branchName: sale.branchName ?? null,
    shiftNumber: sale.shiftNumber ?? null,
    sessionNumber: sale.sessionNumber ?? null,
    saleType: sale.saleType ?? null,
    customerType: sale.customerType ?? null,
    customerBinTin: sale.customerBinTin ?? null,
    customerMembershipId: sale.customerMembershipId ?? null,
    paidAmount: sale.paidAmount ? Number(sale.paidAmount) : 0,
    changeAmount: sale.changeAmount ? Number(sale.changeAmount) : 0,
    dueAmount: sale.dueAmount ? Number(sale.dueAmount) : 0,
    status: sale.status ?? null,
    userId: sale.userId,
    user: sale.user ?? null,
    customerId: sale.customerId,
    customer: sale.customer ?? null,
    subtotal: Number(sale.subtotal),
    discount: Number(sale.discount),
    tax: Number(sale.tax),
    totalAmount: Number(sale.totalAmount),
    loyaltyPointsEarned: sale.loyaltyPointsEarned,
    paymentMethod: sale.paymentMethod,
    payments: sale.payments ? sale.payments.map((payment) => ({
      id: payment.id,
      saleId: payment.saleId,
      method: payment.method,
      amount: Number(payment.amount),
      transactionId: payment.transactionId,
      gatewayReference: payment.gatewayReference,
      authorizationCode: payment.authorizationCode,
      status: payment.status,
      createdAt: payment.createdAt.toISOString()
    })) : [],
    createdAt: sale.createdAt.toISOString(),
    items: sale.items.map((item) => ({
      id: item.id,
      saleId: item.saleId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
      lineSubtotal: Number(item.lineSubtotal),
      productNameSnapshot: item.productNameSnapshot,
      productSkuSnapshot: item.productSkuSnapshot,
      productBarcodeSnapshot: item.productBarcodeSnapshot,
      productUnit: item.productUnit,
      productVariant: item.productVariant,
      productBatch: item.productBatch,
      productExpiry: item.productExpiry,
      productWarrantyId: item.productWarrantyId,
      itemDiscountAmount: Number(item.itemDiscountAmount),
      vatRate: Number(item.vatRate),
      vatAmount: Number(item.vatAmount),
      sdAmount: Number(item.sdAmount),
      serviceChargeAmount: Number(item.serviceChargeAmount),
      product: item.product ?? { name: item.productNameSnapshot, sku: item.productSkuSnapshot }
    }))
  };
}

export async function listSales(limit?: number) {
  const sales = await db().sale.findMany({
    take: limit ?? 100,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, staffId: true, displayName: true, username: true } },
      customer: { select: { id: true, name: true, phone: true } },
      items: true,
      payments: true
    }
  });
  return sales.map(serializeSale);
}

export async function getSale(id: string) {
  const sale = await db().sale.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, staffId: true, displayName: true, username: true } },
      customer: { select: { id: true, name: true, phone: true } },
      items: true,
      payments: true
    }
  });
  if (!sale) throw new Error("Sale not found.");
  return serializeSale(sale);
}

export async function formatSaleAsA4Html(payload: { sale: ReturnType<typeof serializeSale>; settings: BusinessSettings }) {
  const { sale, settings } = payload;
  const fmt = (n: number) => `${settings.currencySymbol}${n.toFixed(2)}`;
  const qrPayload = JSON.stringify({
    invoiceNumber: sale.receiptNumber,
    branchId: sale.branchId,
    branchName: sale.branchName,
    createdAt: sale.createdAt,
    totalAmount: sale.totalAmount,
    invoiceUuid: sale.invoiceUuid
  });
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { type: "image/png", margin: 0, width: 150, color: { dark: "#000000", light: "#FFFFFF" } });

  const itemRows = sale.items.map((item, index) => {
    const description = [item.productNameSnapshot, item.productVariant, item.productBatch ? `Batch: ${item.productBatch}` : null, item.productExpiry ? `Exp: ${item.productExpiry}` : null]
      .filter(Boolean)
      .join(" • ");

    return `<tr>
      <td style="padding:8px 10px;vertical-align:top;word-break:break-word;max-width:210px;">${index + 1}. ${description}</td>
      <td style="padding:8px 10px;text-align:center;vertical-align:top;">${item.quantity}</td>
      <td style="padding:8px 10px;text-align:right;vertical-align:top;">${fmt(item.unitPrice)}</td>
      <td style="padding:8px 10px;text-align:right;vertical-align:top;">${fmt(item.itemDiscountAmount)}</td>
      <td style="padding:8px 10px;text-align:right;vertical-align:top;">${item.vatRate}%</td>
      <td style="padding:8px 10px;text-align:right;vertical-align:top;">${fmt(item.vatAmount)}</td>
      <td style="padding:8px 10px;text-align:right;vertical-align:top;">${fmt(item.lineTotal)}</td>
    </tr>`;
  }).join("");

  const taxBreakdown = sale.items.reduce((acc, item) => {
    const key = `${item.vatRate}%`;
    if (!acc[key]) {
      acc[key] = { rate: item.vatRate, taxable: 0, vat: 0 };
    }
    acc[key].taxable += item.lineSubtotal;
    acc[key].vat += item.vatAmount;
    return acc;
  }, {} as Record<string, { rate: number; taxable: number; vat: number }>);

  const taxRows = Object.values(taxBreakdown).map((row) => `
    <tr>
      <td style="padding:6px 10px">${row.rate}% VAT</td>
      <td style="padding:6px 10px;text-align:right">${fmt(row.taxable)}</td>
      <td style="padding:6px 10px;text-align:right">${fmt(row.vat)}</td>
    </tr>
  `).join("");

  const paymentRows = (sale.payments ?? []).map((payment) => `
    <tr>
      <td style="padding:5px 10px">${payment.method.toUpperCase()}</td>
      <td style="padding:5px 10px;text-align:right">${fmt(payment.amount)}</td>
      <td style="padding:5px 10px">${payment.status ?? "PAID"}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html lang="bn"><head><meta charset="utf-8"><title>Invoice ${sale.receiptNumber ?? sale.id}</title>
<style>
  @page { size: A4 portrait; margin: 16mm; }
  body { margin:0; padding:0; font-family: 'Segoe UI', Arial, sans-serif; color: #111; background: #fff; }
  .page { min-height: calc(100vh - 32mm); display: flex; flex-direction: column; justify-content: space-between; padding: 20px; box-sizing: border-box; }
  .section { page-break-inside: avoid; }
  .brand { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
  .brand img { width: 60px; height: 60px; object-fit: contain; border-radius: 10px; }
  .brand h1 { margin: 0; font-size: 26px; letter-spacing: -0.03em; }
  .business-meta, .invoice-meta, .customer-block, .totals, .footer-block { width: 100%; }
  .business-meta, .customer-block, .invoice-meta, .payment-block { border: 1px solid #ddd; border-radius: 12px; padding: 14px; margin-bottom: 16px; background: #fafafa; }
  .business-meta strong, .customer-block strong, .invoice-meta strong { font-size: 12px; }
  .business-meta p, .customer-block p, .invoice-meta p, .payment-block p { margin: 4px 0; font-size: 12px; line-height: 1.45; }
  .badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; background: #0f766e1a; color: #0f766e; font-size: 11px; font-weight: 700; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  table { width: 100%; border-collapse: collapse; border-spacing: 0; margin-bottom: 16px; }
  th, td { border: 1px solid #d9d9d9; padding: 8px 10px; font-size: 12px; }
  th { background: #111; color: #fff; text-align: left; }
  .text-right { text-align: right; }
  .summary-table td { border: none; padding: 4px 10px; }
  .summary-table .label { color: #333; }
  .summary-table .value { font-weight: 700; }
  .footer-text { font-size: 10px; line-height: 1.5; color: #333; }
  .qr-code { width: 150px; height: 150px; object-fit: contain; border: 1px solid #ddd; padding: 8px; background: #fff; }
  .legal { font-size: 11px; line-height: 1.5; color: #333; margin-top: 24px; }
  @media print {
    body { color-adjust: exact; -webkit-print-color-adjust: exact; }
    .business-meta, .customer-block, .invoice-meta { border-color: #999; }
    .footer-text, .legal { color: #222; }
  }
</style></head><body>
  <div class="page">
    <div class="section">
      <div class="brand">
        ${settings.businessLogoPath ? `<img src="${settings.businessLogoPath}" alt="Logo">` : `<div class="badge">LOGO</div>`}
        <div>
          <h1>${settings.businessName}</h1>
          <p>${settings.branchName ?? settings.businessName} • ${settings.branchAddress ?? settings.address}</p>
          <p>${settings.verifiedPhone ?? "N/A"} • ${settings.email ?? ""} ${settings.website ? `• ${settings.website}` : ""}</p>
          <p>BIN: ${settings.binNumber ?? "N/A"} | TIN: ${settings.tinNumber ?? "N/A"} | Trade License: ${settings.tradeLicenseNumber ?? "N/A"}</p>
        </div>
      </div>

      <div class="business-meta">
        <p><strong>Mushak Registration:</strong> ${settings.mushakRegistration ?? "Pending"}</p>
        <p><strong>Verification QR:</strong> Scan to confirm invoice metadata</p>
      </div>

      <div class="invoice-meta grid-2">
        <div>
          <p><strong>Invoice #:</strong> ${sale.receiptNumber ?? sale.id}</p>
          <p><strong>Terminal ID:</strong> ${sale.terminalId ?? "N/A"}</p>
          <p><strong>Branch ID:</strong> ${sale.branchId ?? "N/A"}</p>
          <p><strong>Sale Type:</strong> ${sale.saleType ?? "Retail"}</p>
        </div>
        <div>
          <p><strong>Date:</strong> ${new Date(sale.createdAt).toISOString().slice(0, 19).replace("T", " ")}</p>
          <p><strong>Cashier:</strong> ${sale.user?.displayName ?? "N/A"}</p>
          <p><strong>Cashier ID:</strong> ${sale.user?.staffId ?? "N/A"}</p>
          <p><strong>Shift / Session:</strong> ${sale.shiftNumber ?? "-"} / ${sale.sessionNumber ?? "-"}</p>
        </div>
      </div>

      <div class="customer-block">
        <p><strong>Customer Type:</strong> ${sale.customerType ?? "WALK_IN"}</p>
        <p><strong>Name:</strong> ${sale.customer?.name ?? "Walk-in Customer"}</p>
        <p><strong>Mobile:</strong> ${sale.customer?.phone ?? "-"}</p>
        <p><strong>BIN / TIN:</strong> ${sale.customerBinTin ?? "-"}</p>
        <p><strong>Membership ID:</strong> ${sale.customerMembershipId ?? "-"}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>SL</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Price</th>
            <th>Discount</th>
            <th>VAT</th>
            <th>VAT Amt</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${sale.items.map((item, index) => {
            const description = [item.productNameSnapshot, item.productVariant, item.productBatch ? `Batch:${item.productBatch}` : null, item.productExpiry ? `Exp:${item.productExpiry}` : null, item.productWarrantyId ? `Wty:${item.productWarrantyId}` : null].filter(Boolean).join(" \n");
            return `
            <tr>
              <td style="padding:8px 10px;">${index + 1}</td>
              <td style="padding:8px 10px;word-break:break-word;white-space:pre-wrap;">${description}</td>
              <td style="padding:8px 10px;text-align:center;">${item.quantity}</td>
              <td style="padding:8px 10px;text-align:center;">${item.productUnit ?? "Pcs"}</td>
              <td style="padding:8px 10px;text-align:right;">${fmt(item.unitPrice)}</td>
              <td style="padding:8px 10px;text-align:right;">${fmt(item.itemDiscountAmount)}</td>
              <td style="padding:8px 10px;text-align:right;">${item.vatRate}%</td>
              <td style="padding:8px 10px;text-align:right;">${fmt(item.vatAmount)}</td>
              <td style="padding:8px 10px;text-align:right;">${fmt(item.lineTotal)}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>

      <div class="grid-2">
        <div class="payment-block">
          <p><strong>Payment Audit Trail</strong></p>
          <table>
            <thead>
              <tr><th>Method</th><th>Amount</th><th>Status</th></tr>
            </thead>
            <tbody>${paymentRows}</tbody>
          </table>
          <p><strong>Invoice Status:</strong> ${sale.status ?? "PAID"}</p>
          <p><strong>Due:</strong> ${fmt(sale.dueAmount ?? 0)} | <strong>Change:</strong> ${fmt(sale.changeAmount ?? 0)}</p>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;">
          <img src="${qrDataUrl}" alt="QR Code" class="qr-code" />
          <p style="font-size:11px;color:#555;margin-top:8px;max-width:160px;">Verification payload included in QR for invoice validation.</p>
        </div>
      </div>

      <div class="totals">
        <table class="summary-table">
          <tr><td class="label">Subtotal</td><td class="value">${fmt(sale.subtotal)}</td></tr>
          <tr><td class="label">Invoice Discount</td><td class="value">-${fmt(sale.discount)}</td></tr>
          <tr><td class="label">VAT Total</td><td class="value">${fmt(sale.tax)}</td></tr>
          ${Object.values(taxBreakdown).length ? `<tr><td colspan="2" style="padding:6px 10px;"><strong>Tax breakdown</strong></td></tr>${taxRows}` : ""}
          <tr><td class="label">Grand Total</td><td class="value">${fmt(sale.totalAmount)}</td></tr>
        </table>
      </div>
    </div>

    <div class="section footer-block legal">
      শর্তাবলী ও নির্দেশনাবলী: ডেলিভারি গ্রহণের সময় পণ্যটি ভালো করে দেখে বুঝে নিন, পরবর্তীতে ফিজিক্যাল ড্যামেজ সংক্রান্ত কোনো অভিযোগ গ্রহণযোগ্য হবে না। পণ্য কেনার পূর্বে সংশ্লিষ্ট ব্র্যান্ডের ওয়ারেন্টি ও গ্যারান্টির শর্তসমূহ বিক্রয়কর্মীর নিকট থেকে জেনে নিন। বিক্রিত পণ্য সাধারণত ফেরত নেওয়া হয় না, তবে বিশেষ ক্ষেত্রে বক্স ও মেমো অক্ষত থাকা সাপেক্ষে ২৪ ঘণ্টার মধ্যে পরিবর্তন করা যেতে পারে। বিশেষ প্রয়োজনে বা ওয়ারেন্টি দাবির ক্ষেত্রে এই মেমো ও মূল বক্স অবশ্যই সাথে আনতে হবে। মেমো ব্যতীত কোনো দাবি বা অভিযোগ গ্রহণযোগ্য নয়। ইনভয়েসে অনিচ্ছাকৃত কোনো হিসাবের ভুল পরিলক্ষিত হলে তা সংশোধনের পূর্ণ ক্ষমতা কর্তৃপক্ষ সংরক্ষণ করে।
    </div>
  </div>
</body></html>`;
}

export async function getSalesAnalytics() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const recentSales = await db().sale.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    orderBy: { createdAt: "asc" },
    include: { items: { include: { product: { select: { name: true, sku: true } } } } }
  });

  const recentExpenses = await db().expense.findMany({
    where: { date: { gte: thirtyDaysAgo } },
    orderBy: { date: "asc" }
  }).catch(() => []);

  const dailyRevenue: Record<string, number> = {};
  const dailyExpenseMap: Record<string, number> = {};
  const productSales: Record<string, { name: string; total: number; count: number }> = {};
  let todayRevenue = 0;
  let todayCount = 0;
  let todayExpenses = 0;

  for (const sale of recentSales) {
    const day = sale.createdAt.toISOString().slice(0, 10);
    const amount = Number(sale.totalAmount);
    dailyRevenue[day] = (dailyRevenue[day] ?? 0) + amount;

    if (sale.createdAt >= todayStart) {
      todayRevenue += amount;
      todayCount++;
    }

    for (const item of sale.items) {
      const key = item.productId;
      if (!productSales[key]) {
        productSales[key] = { name: item.product?.name ?? "Unknown", total: 0, count: 0 };
      }
      productSales[key].total += Number(item.lineTotal);
      productSales[key].count += item.quantity;
    }
  }

  for (const exp of recentExpenses) {
    const day = exp.date.toISOString().slice(0, 10);
    const amount = Number(exp.amount);
    dailyExpenseMap[day] = (dailyExpenseMap[day] ?? 0) + amount;
    if (exp.date >= todayStart) {
      todayExpenses += amount;
    }
  }

  const dailyLabels: string[] = [];
  const dailyValues: number[] = [];
  const dailyExpenses: number[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dailyLabels.push(key.slice(5));
    dailyValues.push(dailyRevenue[key] ?? 0);
    dailyExpenses.push(dailyExpenseMap[key] ?? 0);
  }

  const topProducts = Object.values(productSales)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    todayRevenue,
    todayCount,
    todayExpenses,
    totalSales30d: recentSales.length,
    revenue30d: recentSales.reduce((sum, s) => sum + Number(s.totalAmount), 0),
    expenses30d: recentExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
    dailyLabels,
    dailyValues,
    dailyExpenses,
    topProducts
  };
}

export async function bulkCreateProducts(products: Array<{ sku: string; name: string; price: number; stockLevel: number; lowStockAt?: number; category?: string }>) {
  const created: Array<{ sku: string; name: string }> = [];
  for (const p of products) {
    const existing = await db().product.findUnique({ where: { sku: p.sku } });
    if (existing) continue;
    await db().product.create({
      data: {
        sku: p.sku,
        name: p.name,
        price: new Prisma.Decimal(p.price),
        stockLevel: p.stockLevel,
        lowStockAt: p.lowStockAt ?? 5,
        category: p.category || null
      }
    });
    created.push({ sku: p.sku, name: p.name });
  }
  return { created: created.length, skipped: products.length - created.length };
}

export async function getDashboardStats() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const [todaySales, yesterdaySales, todayItems, newCustomers, lowStock, recentLogs, topProductsRaw, todayExpensesRaw] = await Promise.all([
    db().sale.findMany({ where: { createdAt: { gte: todayStart } }, include: { items: true } }),
    db().sale.findMany({ where: { createdAt: { gte: yesterdayStart, lt: todayStart } } }),
    db().saleItem.findMany({ where: { sale: { createdAt: { gte: todayStart } } }, include: { product: { select: { name: true, imagePath: true } } } }),
    db().customer.count({ where: { createdAt: { gte: todayStart } } }),
    db().$queryRawUnsafe(`SELECT * FROM "Product" WHERE "stockLevel" <= "lowStockAt" ORDER BY "stockLevel" ASC LIMIT 5`) as Promise<Array<{ id: string; name: string; sku: string; stockLevel: number; lowStockAt: number; imagePath: string | null }>>,
    db().auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { displayName: true } } } }),
    db().saleItem.groupBy({ by: ["productId"], _sum: { quantity: true, lineTotal: true }, orderBy: { _sum: { lineTotal: "desc" } }, take: 5 }),
    db().expense.findMany({ where: { date: { gte: todayStart } } }).catch(() => [] as Prisma.ExpenseGetPayload<{}>[]),
  ]);

  const todayExpenses = todayExpensesRaw.reduce((sum, e) => sum + Number(e.amount), 0);

  const todayRevenue = todaySales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
  const yesterdayRevenue = yesterdaySales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
  const revenueChange = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : todayRevenue > 0 ? 100 : 0;
  const todayCount = todaySales.length;
  const yesterdayCount = yesterdaySales.length;
  const orderChange = yesterdayCount > 0 ? ((todayCount - yesterdayCount) / yesterdayCount) * 100 : todayCount > 0 ? 100 : 0;
  const totalItemsSold = todayItems.reduce((sum, i) => sum + i.quantity, 0);

  const hourlyData: { hour: string; revenue: number }[] = [];
  for (let h = 8; h <= 20; h++) {
    const hourStart = new Date(todayStart.getTime() + h * 60 * 60 * 1000);
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
    const revenue = todaySales
      .filter((s) => s.createdAt >= hourStart && s.createdAt < hourEnd)
      .reduce((sum, s) => sum + Number(s.totalAmount), 0);
    hourlyData.push({ hour: `${h.toString().padStart(2, "0")}:00`, revenue });
  }

  const productIds = topProductsRaw.map((p) => p.productId);
  const products = productIds.length > 0 ? await db().product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true, imagePath: true } }) : [];
  const productMap = new Map(products.map((p) => [p.id, p]));
  const topProducts = topProductsRaw.map((p) => ({
    productId: p.productId,
    name: productMap.get(p.productId)?.name ?? "Unknown",
    imagePath: productMap.get(p.productId)?.imagePath ?? null,
    unitsSold: p._sum.quantity ?? 0,
    revenue: Number(p._sum.lineTotal ?? 0),
  }));

  const recentActivity = [
    ...todaySales.slice(0, 3).map((s) => ({
      id: s.id,
      type: "sale" as const,
      description: `New sale #${s.receiptNumber ?? s.id.slice(0, 12)}`,
      amount: Number(s.totalAmount),
      createdAt: s.createdAt.toISOString(),
    })),
    ...todayExpensesRaw.slice(0, 3).map((e) => ({
      id: e.id,
      type: "expense" as const,
      description: `${e.category}: ${e.description || "Logged expense"}`,
      amount: Number(e.amount),
      createdAt: e.date.toISOString(),
    })),
    ...recentLogs.slice(0, 5).map((l) => ({
      id: l.id,
      type: l.action.toLowerCase().includes("product") ? "inventory" as const : "other" as const,
      description: l.description,
      amount: null as number | null,
      createdAt: l.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6);

  return {
    todayRevenue,
    yesterdayRevenue,
    revenueChange,
    todayExpenses,
    todayCount,
    yesterdayCount,
    orderChange,
    totalItemsSold,
    newCustomers,
    hourlyData,
    topProducts,
    lowStock: lowStock.map((p) => ({ id: p.id, name: p.name, sku: p.sku, stockLevel: p.stockLevel, lowStockAt: p.lowStockAt, imagePath: p.imagePath })),
    recentActivity,
  };
}

export async function processReturn(input: {
  actorId?: string;
  saleId: string;
  reason?: string;
  items: Array<{ saleItemId: string; productId: string; quantity: number; unitPrice: number }>;
}) {
  if (!input.items.length) throw new Error("Return must include at least one item.");

  return db().$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id: input.saleId },
      include: { items: true }
    });
    if (!sale) throw new Error("Sale not found.");

    let totalRefund = new Prisma.Decimal(0);
    const refundItems: Array<{
      saleItemId: string;
      productId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
    }> = [];

    for (const item of input.items) {
      const saleItem = sale.items.find((si) => si.id === item.saleItemId);
      if (!saleItem) throw new Error(`Sale item ${item.saleItemId} not found.`);
      if (item.quantity > saleItem.quantity) throw new Error(`Cannot return more than ${saleItem.quantity} of this item.`);

      const unitPrice = new Prisma.Decimal(item.unitPrice);
      const lineTotal = unitPrice.mul(item.quantity);
      totalRefund = totalRefund.add(lineTotal);

      refundItems.push({
        saleItemId: item.saleItemId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        lineTotal
      });

      await tx.product.update({
        where: { id: item.productId },
        data: { stockLevel: { increment: item.quantity } }
      });
    }

    const refund = await tx.refund.create({
      data: {
        saleId: input.saleId,
        reason: input.reason ?? "",
        totalRefund,
        items: { create: refundItems }
      },
      include: { items: true, sale: true }
    });

    await tx.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: "REFUND_PROCESSED",
        entityType: "Refund",
        entityId: refund.id,
        description: `Refund of ${Number(totalRefund)} for sale ${input.saleId}.`,
        metadata: JSON.stringify({ saleId: input.saleId, items: input.items.length })
      }
    });

    return {
      ...refund,
      totalRefund: Number(refund.totalRefund),
      items: refund.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice), lineTotal: Number(i.lineTotal) }))
    };
  });
}

export async function listRefunds(saleId?: string) {
  const where = saleId ? { saleId } : {};
  const refunds = await db().refund.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { items: true, sale: { select: { id: true, receiptNumber: true } } },
    take: 50
  });
  return refunds.map((r) => ({
    ...r,
    totalRefund: Number(r.totalRefund),
    items: r.items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice), lineTotal: Number(i.lineTotal) }))
  }));
}

export async function createExpense(input: { amount: number; category: string; description?: string; date?: string; userId?: string }) {
  const prisma = db();
  try {
    const expense = await prisma.expense.create({
      data: {
        amount: new Prisma.Decimal(input.amount),
        category: input.category,
        description: input.description,
        date: input.date ? new Date(input.date) : undefined,
        userId: input.userId
      }
    });

    if (input.userId) {
      await auditLog({
        actorId: input.userId,
        action: "CREATE",
        entityType: "Expense",
        entityId: expense.id,
        description: `Logged expense of ${input.amount} for ${input.category}`,
        metadata: input
      });
    }

    return {
      ...expense,
      amount: Number(expense.amount),
      date: expense.date.toISOString(),
      createdAt: expense.createdAt.toISOString()
    };
  } catch (err) {
    console.error("Failed to create expense:", err);
    throw new Error("Failed to save expense. Database may be outdated. Please restart the application.");
  }
}

export async function listExpenses(filter?: { startDate?: string; endDate?: string }) {
  const prisma = db();
  const where: Prisma.ExpenseWhereInput = {};
  if (filter?.startDate || filter?.endDate) {
    where.date = {};
    if (filter.startDate) where.date.gte = new Date(filter.startDate);
    if (filter.endDate) where.date.lte = new Date(filter.endDate);
  }

  let expenses: (Prisma.ExpenseGetPayload<{ include: { user: { select: { displayName: true } } } }>)[] = [];
  try {
    expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: "desc" },
      include: { user: { select: { displayName: true } } }
    });
  } catch (err) {
    console.error("Failed to list expenses:", err);
  }

  return expenses.map(e => ({
    ...e,
    amount: Number(e.amount),
    date: e.date.toISOString(),
    createdAt: e.createdAt.toISOString()
  }));
}
