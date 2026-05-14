import type { BusinessSettings } from "./settings";

export function formatThermalReceipt(input: {
  settings: BusinessSettings;
  sale: {
    id: string;
    subtotal: number;
    discount: number;
    tax: number;
    totalAmount: number;
    createdAt: string;
    paymentMethod?: string | null;
    items: Array<{ quantity: number; unitPrice: number; lineTotal: number; product?: { name: string; sku: string } }>;
  };
}) {
  const width = 42;
  const line = "-".repeat(width);
  const center = (text: string) => text.padStart(Math.floor((width + text.length) / 2)).padEnd(width);
  const sym = input.settings.currencySymbol === "৳" ? "TK" : input.settings.currencySymbol;
  const money = (value: number) => `${sym}${value.toFixed(2)}`;

  const rows = [
    center(input.settings.businessName),
    center(input.settings.address),
    input.settings.taxId ? center(`Tax ID: ${input.settings.taxId}`) : "",
    line,
    `Sale: ${input.sale.id}`,
    input.sale.paymentMethod ? `Payment: ${input.sale.paymentMethod}` : "",
    new Date(input.sale.createdAt).toLocaleString(),
    line,
    ...input.sale.items.flatMap((item) => [
      `${item.product?.name ?? "Item"} (${item.product?.sku ?? ""})`.slice(0, width),
      `${item.quantity} x ${money(item.unitPrice)}`.padEnd(24) + money(item.lineTotal).padStart(18)
    ]),
    line,
    "Subtotal".padEnd(24) + money(input.sale.subtotal).padStart(18),
    "Discount".padEnd(24) + money(input.sale.discount).padStart(18),
    "VAT".padEnd(24) + money(input.sale.tax).padStart(18),
    "Total".padEnd(24) + money(input.sale.totalAmount).padStart(18),
    line,
    center("Thank you")
  ];

  return rows.filter(Boolean).join("\n");
}
