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
    transactionId?: string | null;
    terminalId?: string | null;
    shiftNumber?: string | null;
    items: Array<{ quantity: number; unitPrice: number; lineTotal: number; product?: { name: string; sku: string } }>;
    customer?: { name: string; phone: string } | null;
    customerDetails?: { name: string; phone: string; shopName: string; address: string; notes: string } | null;
    user?: { displayName: string; staffId: string } | null;
  };
}) {
  const width = 42;
  const line = "=".repeat(width);
  const thinLine = "-".repeat(width);
  const center = (text: string) => text.padStart(Math.floor((width + text.length) / 2)).padEnd(width);
  const sym = input.settings.currencySymbol === "৳" ? "TK" : input.settings.currencySymbol;
  const money = (value: number) => `${sym}${value.toFixed(2)}`;

  const customerSection = [];
  if (input.sale.customer || input.sale.customerDetails?.name) {
    customerSection.push(thinLine);
    customerSection.push("BILL TO:");
    if (input.sale.customer) {
      customerSection.push(`Name: ${input.sale.customer.name}`);
      customerSection.push(`Phone: ${input.sale.customer.phone}`);
    } else if (input.sale.customerDetails) {
      if (input.sale.customerDetails.name) customerSection.push(`Name: ${input.sale.customerDetails.name}`);
      if (input.sale.customerDetails.phone) customerSection.push(`Phone: ${input.sale.customerDetails.phone}`);
      if (input.sale.customerDetails.shopName) customerSection.push(`Shop: ${input.sale.customerDetails.shopName}`);
      if (input.sale.customerDetails.address) customerSection.push(`Addr: ${input.sale.customerDetails.address}`);
    }
    customerSection.push(thinLine);
  }

  const rows = [
    line,
    center(input.settings.businessName),
    center(input.settings.branchName ?? input.settings.address ?? ""),
    input.settings.branchId ? center(`Branch: ${input.settings.branchId}`) : "",
    input.settings.verifiedPhone ? center(`Phone: ${input.settings.verifiedPhone}`) : "",
    input.settings.binNumber ? center(`BIN: ${input.settings.binNumber}`) : "",
    input.settings.tinNumber ? center(`TIN: ${input.settings.tinNumber}`) : "",
    input.settings.tradeLicenseNumber ? center(`Trade: ${input.settings.tradeLicenseNumber}`) : "",
    input.settings.mushakRegistration ? center(`Mushak: ${input.settings.mushakRegistration}`) : "",
    input.settings.taxId ? center(`Tax ID: ${input.settings.taxId}`) : "",
    line,
    "",
    center("INVOICE / RECEIPT"),
    "",
    `Invoice #: ${input.sale.id}`,
    `Date: ${new Date(input.sale.createdAt).toLocaleString()}`,
    `Seller: ${input.sale.user?.displayName ?? "N/A"} (${input.sale.user?.staffId ?? ""})`,
    `Payment: ${input.sale.paymentMethod ?? "Cash"}`,
    `Transaction: ${input.sale.transactionId ?? "-"}`,
    `Terminal: ${input.sale.terminalId ?? "-"}`,
    `Shift: ${input.sale.shiftNumber ?? "-"}`,
    "",
    ...customerSection,
    thinLine,
    "ITEM".padEnd(20) + "QTY".padEnd(8) + "TOTAL",
    thinLine,
    ...input.sale.items.flatMap((item) => {
      const sku = item.product?.sku ?? "";
      const batch = (item as any).productBatch ?? "";
      const itemDiscount = (item as any).itemDiscountAmount ?? 0;
      const vatRate = (item as any).vatRate ?? 0;
      const vatAmount = (item as any).vatAmount ?? 0;
      const nameLine = `${(item.product?.name ?? "Item")}`.slice(0, 20).padEnd(20) + `${item.quantity}`.padEnd(8) + money(item.lineTotal);
      const metaLine = `${sku ? `[${sku}] ` : ""}${batch ? `(B:${batch}) ` : ""}${vatRate ? `${vatRate}% VAT ` : ""}${itemDiscount ? `Disc:${money(itemDiscount)} ` : ""}`.slice(0, 20).padEnd(20) + `x${money(item.unitPrice)}`.padEnd(8) + `${vatAmount ? money(vatAmount) : ""}`;
      return [nameLine, metaLine];
    }),
    thinLine,
    "",
    "Subtotal".padEnd(24) + money(input.sale.subtotal).padStart(18),
    input.sale.discount > 0 ? "Discount".padEnd(24) + `-${money(input.sale.discount)}`.padStart(18) : "",
    // VAT summary grouped by rate
    ...(() => {
      const groups = (input.sale.items || []).reduce((acc: Record<string, { rate: number; vat: number; taxable: number }>, it: any) => {
        const key = `${it.vatRate ?? 0}`;
        if (!acc[key]) acc[key] = { rate: Number(it.vatRate ?? 0), vat: 0, taxable: 0 };
        acc[key].vat += Number(it.vatAmount ?? 0);
        acc[key].taxable += Number((it.lineSubtotal ?? (it.lineTotal - (it.vatAmount ?? 0))) ?? 0);
        return acc;
      }, {} as Record<string, { rate: number; vat: number; taxable: number }>);
      return Object.values(groups).flatMap(g => [`VAT ${g.rate}%`.padEnd(24) + money(g.vat).padStart(18)]);
    })(),
    "",
    "TOTAL".padEnd(24) + money(input.sale.totalAmount).padStart(18),
    line,
    "",
    "শর্তাবলী ও নির্দেশনাবলী: ডেলিভারি গ্রহণের সময় পণ্যটি ভালো করে দেখে বুঝে নিন, পরবর্তীতে ফিজিক্যাল ড্যামেজ সংক্রান্ত কোনো অভিযোগ গ্রহণযোগ্য হবে না। পণ্য কেনার পূর্বে সংশ্লিষ্ট ব্র্যান্ডের ওয়ারেন্টি ও গ্যারান্টির শর্তসমূহ বিক্রয়কর্মীর নিকট থেকে জেনে নিন। বিক্রিত পণ্য সাধারণত ফেরত নেওয়া হয় না, তবে বিশেষ ক্ষেত্রে বক্স ও মেমো অক্ষত থাকা সাপেক্ষে ২৪ ঘণ্টার মধ্যে পরিবর্তন করা যেতে পারে। বিশেষ প্রয়োজনে বা ওয়ারেন্টি দাবির ক্ষেত্রে এই মেমো ও মূল বক্স অবশ্যই সাথে আনতে হবে। মেমো ব্যতীত কোনো দাবি বা অভিযোগ গ্রহণযোগ্য নয়। ইনভয়েসে অনিচ্ছাকৃত কোনো হিসাবের ভুল পরিলক্ষিত হলে তা সংশোধনের পূর্ণ ক্ষমতা কর্তৃপক্ষ সংরক্ষণ করে।",
    "",
    `Software-generated by ${input.settings.businessName}`,
    input.settings.address ?? "",
    line
  ];

  return rows.filter(Boolean).join("\n");
}
