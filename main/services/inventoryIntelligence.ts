import { shell } from "electron";
import { db } from "./database";
import { getSettings } from "./settings";

export async function getLowStockProducts() {
  const products = await db().product.findMany({ orderBy: { stockLevel: "asc" } });
  return products
    .filter((product) => product.stockLevel <= product.lowStockAt)
    .map((product) => ({ ...product, price: Number(product.price) }));
}

export async function sendLowStockEmail() {
  const settings = await getSettings();
  const products = await getLowStockProducts();
  if (!settings.lowStockEmail) {
    throw new Error("Configure a low-stock email address first.");
  }

  const body = products.length
    ? products.map((product) => `${product.sku} - ${product.name}: ${product.stockLevel} left`).join("\n")
    : "No low-stock products right now.";

  const mailto = `mailto:${encodeURIComponent(settings.lowStockEmail)}?subject=${encodeURIComponent(
    `${settings.businessName} low stock alert`
  )}&body=${encodeURIComponent(body)}`;

  await shell.openExternal(mailto);
  return { ok: true, count: products.length };
}

export function generateBarcodeSvg(value: string) {
  const bars = value
    .split("")
    .map((char) => char.charCodeAt(0).toString(2).padStart(8, "0"))
    .join("101");
  const width = bars.length * 2 + 24;
  const rects = bars
    .split("")
    .map((bit, index) => (bit === "1" ? `<rect x="${12 + index * 2}" y="10" width="2" height="54" />` : ""))
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="92" viewBox="0 0 ${width} 92"><rect width="100%" height="100%" fill="white"/><g fill="black">${rects}</g><text x="50%" y="82" text-anchor="middle" font-family="monospace" font-size="12">${value}</text></svg>`;
}

export async function generateBarcodeForProduct(productId: string) {
  const product = await db().product.findUnique({ where: { id: productId } });
  if (!product) {
    throw new Error("Product not found.");
  }
  const barcodeSvg = generateBarcodeSvg(product.sku);
  await db().product.update({ where: { id: productId }, data: { barcodeSvg } });
  return { productId, sku: product.sku, barcodeSvg };
}
