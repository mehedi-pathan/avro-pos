import { Prisma } from "@prisma/client";
import { db } from "./database";
import { auditLog } from "./audit";
import { getSettings } from "./settings";

export type SaleInput = {
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

    const saleItems = input.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      const unitPrice = new Prisma.Decimal(product.price);
      const lineTotal = unitPrice.mul(item.quantity);

      return {
        productId: product.id,
        quantity: item.quantity,
        unitPrice,
        lineTotal
      };
    });

    const subtotal = saleItems.reduce((sum, item) => sum.add(item.lineTotal), new Prisma.Decimal(0));
    const discount = new Prisma.Decimal(input.discount ?? 0);
    const discountedSubtotal = subtotal.sub(discount);
    const taxable = discountedSubtotal.lessThan(0) ? new Prisma.Decimal(0) : discountedSubtotal;
    const tax = taxable.mul(input.taxRate ?? 0.05);
    const totalAmount = taxable.add(tax);
    const loyaltyPointsEarned = Math.floor(Number(totalAmount));

    const settings = await getSettings();
    const prefix = (settings.businessName || "AVRO").split(/\s+/)[0].toUpperCase().replace(/[^A-Z0-9]/g, "");
    const year = new Date().getFullYear();
    const count = await tx.sale.count();
    const receiptNumber = `${prefix}-${year}-${String(count + 1).padStart(4, "0")}`;

    const sale = await tx.sale.create({
      data: {
        receiptNumber,
        userId: input.userId,
        customerId: input.customerId || null,
        subtotal,
        discount,
        tax,
        totalAmount,
        loyaltyPointsEarned,
        paymentMethod: input.paymentMethod ?? null,
        items: {
          create: saleItems
        }
      },
      include: { items: true }
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
        data: { points: { increment: loyaltyPointsEarned } }
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: input.actorId ?? input.userId ?? null,
        action: "SALE_COMPLETED",
        entityType: "Sale",
        entityId: sale.id,
        description: `Completed sale ${sale.id} totaling ${Number(totalAmount)}.`,
        metadata: JSON.stringify({ customerId: input.customerId ?? null, discount: Number(discount), paymentMethod: input.paymentMethod ?? null })
      }
    });

    return {
      ...sale,
      receiptNumber: sale.receiptNumber ?? `${prefix}-${year}-${String(count + 1).padStart(4, "0")}`,
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      tax: Number(sale.tax),
      totalAmount: Number(sale.totalAmount),
      paymentMethod: sale.paymentMethod ?? null,
      createdAt: sale.createdAt.toISOString(),
      items: sale.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal)
      }))
    };
  });
}

function serializeSale(sale: {
  id: string;
  receiptNumber: string | null;
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
  createdAt: Date;
  items: Array<{
    id: string;
    saleId: string;
    productId: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
    product?: { name: string; sku: string };
  }>;
}) {
  return {
    id: sale.id,
    receiptNumber: sale.receiptNumber,
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
    createdAt: sale.createdAt.toISOString(),
    items: sale.items.map((item) => ({
      id: item.id,
      saleId: item.saleId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
      product: item.product ?? { name: "Unknown", sku: "" }
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
      items: { include: { product: { select: { name: true, sku: true } } } }
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
      items: { include: { product: { select: { name: true, sku: true } } } }
    }
  });
  if (!sale) throw new Error("Sale not found.");
  return serializeSale(sale);
}

export function formatSaleAsA4Html(sale: ReturnType<typeof serializeSale>, businessName: string, currencySymbol: string) {
  const fmt = (n: number) => `${currencySymbol}${n.toFixed(2)}`;
  const itemsHtml = sale.items.map((item) => `
    <tr>
      <td style="padding:6px 8px">${item.product.name}</td>
      <td style="padding:6px 8px;text-align:center">${item.quantity}</td>
      <td style="padding:6px 8px;text-align:right">${fmt(item.unitPrice)}</td>
      <td style="padding:6px 8px;text-align:right">${fmt(item.lineTotal)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Receipt ${sale.id}</title>
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: 'Segoe UI',Arial,sans-serif; color:#17202a; padding:20px; max-width:210mm; margin:0 auto; }
  .header { text-align:center; margin-bottom:24px; border-bottom:2px solid #247b7b; padding-bottom:16px; }
  .header h1 { margin:0; font-size:24px; color:#247b7b; }
  .header p { margin:4px 0 0; color:#666; font-size:13px; }
  .meta { display:flex; justify-content:space-between; margin-bottom:20px; font-size:13px; color:#444; }
  table { width:100%; border-collapse:collapse; margin-bottom:20px; }
  th { background:#247b7b; color:#fff; padding:8px; text-align:left; font-size:13px; }
  td { border-bottom:1px solid #ddd; padding:8px; font-size:13px; }
  .totals { width:300px; margin-left:auto; }
  .totals td { border:none; padding:4px 8px; }
  .totals .final td { font-size:16px; font-weight:700; border-top:2px solid #247b7b; padding-top:8px; }
  .footer { text-align:center; margin-top:32px; padding-top:16px; border-top:1px solid #ddd; font-size:11px; color:#999; }
  @media print { body { padding:0; } }
</style></head><body>
  <div class="header">
    <h1>${businessName}</h1>
    <p>Sales Receipt</p>
  </div>
  <div class="meta">
    <div><strong>Receipt #:</strong> ${sale.id}<br>
         <strong>Date:</strong> ${new Date(sale.createdAt).toLocaleString()}</div>
    <div style="text-align:right"><strong>Salesperson:</strong> ${sale.user?.displayName ?? "N/A"}<br>
         <strong>Staff ID:</strong> ${sale.user?.staffId ?? "N/A"}</div>
  </div>
  ${sale.customer ? `<p><strong>Customer:</strong> ${sale.customer.name} (${sale.customer.phone})</p>` : ""}
  <p><strong>Payment:</strong> ${sale.paymentMethod ?? "Cash"}</p>
  <table><thead><tr><th>Item</th><th style="width:60px">Qty</th><th style="width:90px">Price</th><th style="width:90px">Total</th></tr></thead>
  <tbody>${itemsHtml}</tbody></table>
  <table class="totals">
    <tr><td>Subtotal</td><td style="text-align:right">${fmt(sale.subtotal)}</td></tr>
    ${sale.discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">-${fmt(sale.discount)}</td></tr>` : ""}
    <tr><td>VAT</td><td style="text-align:right">${fmt(sale.tax)}</td></tr>
    <tr class="final"><td>Total</td><td style="text-align:right">${fmt(sale.totalAmount)}</td></tr>
  </table>
  ${sale.loyaltyPointsEarned > 0 ? `<p style="font-size:12px;color:#666">Loyalty points earned: ${sale.loyaltyPointsEarned}</p>` : ""}
  <div class="footer">Thank you for your business!<br>Receipt generated by Avro POS</div>
  <script>window.print();<\/script>
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

  const dailyRevenue: Record<string, number> = {};
  const productSales: Record<string, { name: string; total: number; count: number }> = {};
  let todayRevenue = 0;
  let todayCount = 0;

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

  const dailyLabels: string[] = [];
  const dailyValues: number[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dailyLabels.push(key.slice(5));
    dailyValues.push(dailyRevenue[key] ?? 0);
  }

  const topProducts = Object.values(productSales)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    todayRevenue,
    todayCount,
    totalSales30d: recentSales.length,
    revenue30d: recentSales.reduce((sum, s) => sum + Number(s.totalAmount), 0),
    dailyLabels,
    dailyValues,
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

  const [todaySales, yesterdaySales, todayItems, newCustomers, lowStock, recentLogs, topProductsRaw] = await Promise.all([
    db().sale.findMany({ where: { createdAt: { gte: todayStart } }, include: { items: true } }),
    db().sale.findMany({ where: { createdAt: { gte: yesterdayStart, lt: todayStart } } }),
    db().saleItem.findMany({ where: { sale: { createdAt: { gte: todayStart } } }, include: { product: { select: { name: true, imagePath: true } } } }),
    db().customer.count({ where: { createdAt: { gte: todayStart } } }),
    db().product.findMany({ where: { stockLevel: { lte: db().product.fields.lowStockAt } }, orderBy: { stockLevel: "asc" }, take: 5 }),
    db().auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { displayName: true } } } }),
    db().saleItem.groupBy({ by: ["productId"], _sum: { quantity: true, lineTotal: true }, orderBy: { _sum: { lineTotal: "desc" } }, take: 5 }),
  ]);

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
