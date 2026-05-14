"use client";

import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { money } from "@/components/Money";
import { useAuth } from "@/hooks/useAuth";
import { avroApi } from "@/lib/api";
import type { BusinessSettings, Sale } from "@/lib/types";

function receiptHtml(sale: Sale, settings: BusinessSettings, mode: "A4" | "POS") {
  const fmt = (n: number) => `${settings.currencySymbol}${n.toFixed(2)}`;
  const itemsHtml = sale.items.map((item) => mode === "A4"
    ? `<tr><td style="padding:6px 8px">${item.product.name}</td><td style="padding:6px 8px;text-align:center">${item.quantity}</td><td style="padding:6px 8px;text-align:right">${fmt(item.unitPrice)}</td><td style="padding:6px 8px;text-align:right">${fmt(item.lineTotal)}</td></tr>`
    : `<tr><td colspan="2" style="padding:3px 4px;font-size:11px">${item.product.name} x${item.quantity}</td><td style="padding:3px 4px;text-align:right;font-size:11px">${fmt(item.lineTotal)}</td></tr>`
  ).join("");

  if (mode === "POS") {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>POS Receipt</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  body { font-family:monospace; font-size:12px; width:72mm; margin:0 auto; padding:4mm 0; color:#000; }
  .c { text-align:center; }
  .b { font-weight:700; }
  table { width:100%; border-collapse:collapse; }
  td { padding:2px 0; }
  .line { border-top:1px dashed #000; margin:4px 0; }
  .line2 { border-top:2px solid #000; margin:4px 0; }
</style></head><body>
<div class="c"><b>${settings.businessName}</b><br>${settings.address}${settings.taxId ? `<br>Tax ID: ${settings.taxId}` : ""}<br>${new Date(sale.createdAt).toLocaleString()}</div>
<div class="line"></div>
<p style="font-size:10px;margin:2px 0">Receipt: ${sale.receiptNumber ?? sale.id.slice(0, 12)}<br>
Salesperson: ${sale.user?.displayName ?? "N/A"} (${sale.user?.staffId ?? ""})</p>
${sale.customer ? `<p style="font-size:10px;margin:2px 0">Customer: ${sale.customer.name}${sale.customer.phone?.startsWith("vip") ? " (VIP)" : ` (${sale.customer.phone})`}</p>` : ""}
<div class="line"></div>
<table>${itemsHtml}</table>
<div class="line"></div>
<table style="width:100%">
<tr><td>Subtotal</td><td style="text-align:right">${fmt(sale.subtotal)}</td></tr>
${sale.discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">-${fmt(sale.discount)}</td></tr>` : ""}
<tr><td>Tax</td><td style="text-align:right">${fmt(sale.tax)}</td></tr></table>
<div class="line2"></div>
<table style="width:100%">
<tr class="b"><td>Total</td><td style="text-align:right">${fmt(sale.totalAmount)}</td></tr></table>
${sale.loyaltyPointsEarned > 0 ? `<p style="font-size:10px;margin:2px 0">Points earned: ${sale.loyaltyPointsEarned}</p>` : ""}
<div class="line"></div>
<div class="c" style="font-size:9px;color:#666;margin-top:4px">Thank you for your business!<br>Powered by Avro POS v2.0.3.12</div>
<div class="c" style="font-size:8px;color:#999;margin-top:2px">Developed by Mehedi Pathan</div>
<script>window.print();<\/script></body></html>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Receipt ${sale.receiptNumber ?? sale.id}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family:'Segoe UI',Arial,sans-serif; color:#17202a; padding:20px; max-width:210mm; margin:0 auto; }
  .header { text-align:center; margin-bottom:20px; border-bottom:2px solid #ffe900; padding-bottom:14px; }
  .header h1 { margin:0; font-size:22px; color:#221e1e; }
  .header p { margin:3px 0 0; color:#666; font-size:12px; }
  .meta { display:flex; justify-content:space-between; margin-bottom:16px; font-size:12px; color:#444; }
  table { width:100%; border-collapse:collapse; margin-bottom:16px; }
  th { background:#221e1e; color:#fff; padding:7px; text-align:left; font-size:12px; }
  th:last-child { text-align:right; }
  td { border-bottom:1px solid #ddd; padding:7px; font-size:12px; }
  .totals { width:280px; margin-left:auto; }
  .totals td { border:none; padding:3px 8px; }
  .totals .final td { font-size:15px; font-weight:700; border-top:2px solid #221e1e; padding-top:6px; }
  .footer { text-align:center; margin-top:24px; padding-top:12px; border-top:1px solid #ddd; font-size:10px; color:#999; }
  @media print { body { padding:0; } }
</style></head><body>
<div class="header">
  <h1>${settings.businessName}</h1>
  <p>${settings.address}${settings.taxId ? ` | Tax ID: ${settings.taxId}` : ""}</p>
</div>
<div class="meta">
  <div><strong>Receipt:</strong> ${sale.receiptNumber ?? sale.id}<br><strong>Date:</strong> ${new Date(sale.createdAt).toLocaleString()}</div>
  <div style="text-align:right"><strong>Salesperson:</strong> ${sale.user?.displayName ?? "N/A"}<br><strong>Staff ID:</strong> ${sale.user?.staffId ?? "N/A"}</div>
</div>
${sale.customer ? `<p style="font-size:12px;margin-bottom:10px"><strong>Customer:</strong> ${sale.customer.name}${sale.customer.phone?.startsWith("vip") ? " (VIP)" : ` &mdash; ${sale.customer.phone}`}</p>` : ""}
<table><thead><tr><th>Item</th><th style="width:50px;text-align:center">Qty</th><th style="width:80px;text-align:right">Price</th><th style="width:80px;text-align:right">Total</th></tr></thead>
<tbody>${itemsHtml}</tbody></table>
<table class="totals">
  <tr><td>Subtotal</td><td style="text-align:right">${fmt(sale.subtotal)}</td></tr>
  ${sale.discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">-${fmt(sale.discount)}</td></tr>` : ""}
  <tr><td>Tax</td><td style="text-align:right">${fmt(sale.tax)}</td></tr>
  <tr class="final"><td>Total</td><td style="text-align:right">${fmt(sale.totalAmount)}</td></tr>
</table>
${sale.loyaltyPointsEarned > 0 ? `<p style="font-size:11px;color:#666">Loyalty points earned: ${sale.loyaltyPointsEarned}</p>` : ""}
<div class="footer">Thank you for your business!<br>Powered by Avro POS v2.0.3.12 &mdash; Developed by Mehedi Pathan</div>
<script>window.print();<\/script></body></html>`;
}

function dateFloor(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function SalesHistoryPage() {
  const { hasCapability, user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{ sale: Sale; mode: "A4" | "POS" } | null>(null);
  const [refundMode, setRefundMode] = useState<string | null>(null);
  const [refundQtys, setRefundQtys] = useState<Record<string, number>>({});
  const [refundReason, setRefundReason] = useState("");
  const [processingRefund, setProcessingRefund] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [quickFilter, setQuickFilter] = useState<"all" | "today" | "7d" | "30d">("all");

  async function loadSales() {
    try {
      const data = await avroApi().listSales(500);
      setSales(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load sales.");
    }
  }

  useEffect(() => {
    if (hasCapability("REPORTS")) {
      loadSales();
    }
  }, [hasCapability]);

  const filteredSales = useMemo(() => {
    let filtered = sales;
    const now = new Date();
    const today = dateFloor(now);

    if (quickFilter === "today") {
      filtered = filtered.filter(s => new Date(s.createdAt) >= today);
    } else if (quickFilter === "7d") {
      const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(s => new Date(s.createdAt) >= weekAgo);
    } else if (quickFilter === "30d") {
      const monthAgo = new Date(today); monthAgo.setDate(monthAgo.getDate() - 30);
      filtered = filtered.filter(s => new Date(s.createdAt) >= monthAgo);
    }

    if (dateFrom) {
      const from = dateFloor(new Date(dateFrom));
      filtered = filtered.filter(s => new Date(s.createdAt) >= from);
    }
    if (dateTo) {
      const to = dateFloor(new Date(dateTo));
      to.setDate(to.getDate() + 1);
      filtered = filtered.filter(s => new Date(s.createdAt) < to);
    }

    return filtered;
  }, [sales, quickFilter, dateFrom, dateTo]);

  const summary = useMemo(() => {
    const totalRevenue = filteredSales.reduce((s, sale) => s + sale.totalAmount, 0);
    const totalDiscount = filteredSales.reduce((s, sale) => s + sale.discount, 0);
    const totalTax = filteredSales.reduce((s, sale) => s + sale.tax, 0);
    const totalItems = filteredSales.reduce((s, sale) => s + sale.items.length, 0);
    const totalSales = filteredSales.length;
    return { totalRevenue, totalDiscount, totalTax, totalItems, totalSales };
  }, [filteredSales]);

  function exportCsv() {
    const headers = ["Receipt #", "Date", "Salesperson", "Customer", "Items", "Subtotal", "Discount", "Tax", "Total", "Loyalty Pts"];
    const rows = filteredSales.map(sale => [
      sale.receiptNumber ?? sale.id.slice(0, 12),
      new Date(sale.createdAt).toLocaleString(),
      sale.user?.displayName ?? "N/A",
      sale.customer?.name ?? "Walk-in",
      sale.items.length,
      sale.subtotal,
      sale.discount,
      sale.tax,
      sale.totalAmount,
      sale.loyaltyPointsEarned
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function showPreview(sale: Sale, mode: "A4" | "POS") {
    setPreview({ sale, mode });
  }

  function doPrint() {
    if (!preview) return;
    avroApi().getSettings().then((settings) => {
      const html = receiptHtml(preview.sale, settings, preview.mode);
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
      }
      setPreview(null);
    });
  }

  function openRefund(saleId: string) {
    setRefundMode(saleId);
    setRefundReason("");
    const sale = sales.find(s => s.id === saleId);
    if (sale) {
      const q: Record<string, number> = {};
      sale.items.forEach(item => { q[item.id] = 0; });
      setRefundQtys(q);
    }
  }

  async function processRefund() {
    if (!refundMode) return;
    setProcessingRefund(true);
    setMessage("");
    try {
      const sale = sales.find(s => s.id === refundMode);
      if (!sale) throw new Error("Sale not found.");
      const items = sale.items
        .filter(item => (refundQtys[item.id] ?? 0) > 0)
        .map(item => ({
          saleItemId: item.id,
          productId: item.productId,
          quantity: refundQtys[item.id],
          unitPrice: item.unitPrice
        }));
      if (!items.length) throw new Error("Select at least one item to refund.");
      await avroApi().processReturn({ actorId: user?.id, saleId: refundMode, reason: refundReason, items });
      setRefundMode(null);
      setMessage("Refund processed successfully.");
      await loadSales();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Refund failed.");
    } finally {
      setProcessingRefund(false);
    }
  }

  if (!hasCapability("REPORTS")) {
    return (
      <MainLayout title="Sales History">
        <div className="rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-5 backdrop-blur-xl">Manager or Owner access required.</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Sales History">
      {message ? <p className="mb-4 rounded border border-[var(--border-default)] bg-[var(--bg-overlay)] p-3 text-sm text-[var(--text-message)]">{message}</p> : null}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-3 backdrop-blur-xl">
          <p className="text-xs text-[var(--text-secondary)]">Sales</p>
          <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">{summary.totalSales}</p>
        </div>
        <div className="rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-3 backdrop-blur-xl">
          <p className="text-xs text-[var(--text-secondary)]">Revenue</p>
          <p className="mt-1 text-xl font-bold text-teal">{money(summary.totalRevenue)}</p>
        </div>
        <div className="rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-3 backdrop-blur-xl">
          <p className="text-xs text-[var(--text-secondary)]">Discounts</p>
          <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">{money(summary.totalDiscount)}</p>
        </div>
        <div className="rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-3 backdrop-blur-xl">
          <p className="text-xs text-[var(--text-secondary)]">Items sold</p>
          <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">{summary.totalItems}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-1">
          {(["all", "today", "7d", "30d"] as const).map(f => (
            <button key={f} className={`rounded px-3 py-1 text-xs font-medium transition-colors ${quickFilter === f ? "bg-teal text-ink" : "text-[var(--text-mid)] hover:text-[var(--text-primary)]"}`} onClick={() => { setQuickFilter(f); setDateFrom(""); setDateTo(""); }}>
              {f === "all" ? "All" : f === "today" ? "Today" : f === "7d" ? "7 Days" : "30 Days"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <input className="rounded border border-[var(--border-default)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)]" type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setQuickFilter("all"); }} />
          <span className="text-xs text-[var(--text-muted)]">to</span>
          <input className="rounded border border-[var(--border-default)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)]" type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setQuickFilter("all"); }} />
        </div>
        {hasCapability("DELETE_RECORDS") ? (
          <button className="ml-auto flex items-center gap-1.5 rounded bg-teal px-3 py-1.5 text-xs font-medium text-ink" onClick={exportCsv}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-2m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        ) : null}
      </div>

      <div className="min-w-0 overflow-auto rounded border border-[var(--border-default)] bg-[var(--bg-card)] shadow-sm backdrop-blur-xl">
        <table className="w-full min-w-[600px] border-collapse text-left text-sm">
          <thead className="bg-[var(--bg-card)] text-[var(--text-default)]">
            <tr>
              <th className="p-3">Receipt #</th>
              <th className="p-3">Date &amp; Time</th>
              <th className="p-3">Salesperson</th>
              <th className="p-3">Customer</th>
              <th className="p-3 text-right">Items</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.length === 0 ? (
              <tr>
                <td className="p-8 text-center text-[var(--text-secondary)]" colSpan={7}>No sales found.</td>
              </tr>
            ) : (
              filteredSales.map((sale) => (
                <tr
                  key={sale.id}
                  className={`border-t border-[var(--border-default)] cursor-pointer ${selected?.id === sale.id ? "bg-[var(--bg-card)]" : "hover:bg-[var(--bg-card)]"}`}
                  onClick={() => setSelected(selected?.id === sale.id ? null : sale)}
                >
                  <td className="p-3 font-mono text-xs">{sale.receiptNumber ?? sale.id.slice(0, 12)}</td>
                  <td className="p-3 whitespace-nowrap">{new Date(sale.createdAt).toLocaleString()}</td>
                  <td className="p-3">{sale.user?.displayName ?? "N/A"}</td>
                  <td className="p-3">{sale.customer?.name ?? "Walk-in"}{sale.customer?.phone?.startsWith("vip") ? " (VIP)" : ""}</td>
                  <td className="p-3 text-right">{sale.items.length}</td>
                  <td className="p-3 text-right font-semibold">{money(sale.totalAmount)}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <button className="rounded border border-[var(--border-light)] px-3 py-1 text-xs" onClick={() => showPreview(sale, "A4")}>A4</button>
                      <button className="rounded border border-[var(--border-light)] px-3 py-1 text-xs" onClick={() => showPreview(sale, "POS")}>POS</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="mt-4 rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-5 backdrop-blur-xl">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h3 className="font-semibold">Sale Details &mdash; {selected.receiptNumber ?? selected.id.slice(0, 12)}</h3>
              <p className="text-xs text-[var(--text-secondary)] font-mono mt-1">ID: {selected.id}</p>
            </div>
            <div className="flex gap-2">
              <button className="rounded bg-teal px-3 py-1.5 text-xs font-medium text-ink" onClick={() => showPreview(selected, "A4")}>Print A4</button>
              <button className="rounded border border-[var(--border-light)] px-3 py-1.5 text-xs" onClick={() => showPreview(selected, "POS")}>Print POS</button>
              <button className="rounded border border-red-400/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-400/10" onClick={() => openRefund(selected.id)}>Refund</button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 mb-4">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Salesperson</p>
              <p className="text-sm font-medium">{selected.user?.displayName ?? "N/A"}</p>
              <p className="text-xs text-[var(--text-secondary)]">{selected.user?.staffId ?? ""}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Date &amp; Time</p>
              <p className="text-sm font-medium">{new Date(selected.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Customer</p>
              <p className="text-sm font-medium">{selected.customer?.name ?? "Walk-in"}</p>
              {selected.customer && !selected.customer.phone?.startsWith("vip") && <p className="text-xs text-[var(--text-secondary)]">{selected.customer.phone}</p>}
              {selected.customer?.phone?.startsWith("vip") && <p className="text-xs text-[var(--text-secondary)]">VIP</p>}
            </div>
          </div>

          <table className="w-full text-left text-sm">
            <thead className="text-[var(--text-mid)] text-xs">
              <tr>
                <th className="pb-2 font-medium">Item</th>
                <th className="pb-2 font-medium text-center">Qty</th>
                <th className="pb-2 font-medium text-right">Price</th>
                <th className="pb-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {selected.items.map((item) => (
                <tr key={item.id} className="border-t border-[var(--border-default)]">
                  <td className="py-2">{item.product.name}</td>
                  <td className="py-2 text-center">{item.quantity}</td>
                  <td className="py-2 text-right">{money(item.unitPrice)}</td>
                  <td className="py-2 text-right">{money(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 ml-auto w-64 space-y-1 text-sm">
            <div className="flex justify-between text-[var(--text-default)]">
              <span>Subtotal</span>
              <span>{money(selected.subtotal)}</span>
            </div>
            {selected.discount > 0 && (
              <div className="flex justify-between text-[var(--text-default)]">
                <span>Discount</span>
                <span>-{money(selected.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-[var(--text-default)]">
              <span>Tax</span>
              <span>{money(selected.tax)}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--border-default)] pt-1 font-semibold text-lg">
              <span>Total</span>
              <span>{money(selected.totalAmount)}</span>
            </div>
            {selected.loyaltyPointsEarned > 0 && (
              <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                <span>Loyalty points</span>
                <span>+{selected.loyaltyPointsEarned}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {refundMode && (() => {
        const sale = sales.find(s => s.id === refundMode);
        if (!sale) return null;
        const selectedItems = sale.items.filter(item => (refundQtys[item.id] ?? 0) > 0);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setRefundMode(null)}>
            <div className="mx-4 w-full max-w-lg rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-2xl backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">Process Refund</h3>
              <p className="mb-4 text-sm text-[var(--text-mid)]">Sale: {sale.receiptNumber ?? sale.id.slice(0, 12)}</p>
              <table className="w-full text-left text-sm">
                <thead className="text-[var(--text-mid)] text-xs">
                  <tr><th className="pb-2 font-medium">Item</th><th className="pb-2 font-medium text-center">Sold</th><th className="pb-2 font-medium text-right">Refund Qty</th></tr>
                </thead>
                <tbody>
                  {sale.items.map((item) => (
                    <tr key={item.id} className="border-t border-[var(--border-default)]">
                      <td className="py-2">{item.product.name}</td>
                      <td className="py-2 text-center">{item.quantity}</td>
                      <td className="py-2 text-right">
                        <input
                          className="w-16 rounded bg-[var(--bg-input)] px-2 py-1 text-right text-ink text-sm"
                          type="number" min={0} max={item.quantity}
                          value={refundQtys[item.id] ?? 0}
                          onChange={(e) => setRefundQtys({ ...refundQtys, [item.id]: Math.min(Number(e.target.value), item.quantity) })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <label className="mt-4 block text-sm">
                Reason (optional)
                <input className="mt-1 w-full rounded bg-[var(--bg-input)] px-3 py-2 text-ink text-sm" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Damaged, wrong item, etc." />
              </label>
              {selectedItems.length > 0 && (
                <p className="mt-3 text-sm text-[var(--text-default)]">
                  Refunding {selectedItems.reduce((s, i) => s + (refundQtys[i.id] ?? 0), 0)} item(s) — ৳
                  {selectedItems.reduce((s, i) => s + (refundQtys[i.id] ?? 0) * i.unitPrice, 0).toFixed(2)}
                </p>
              )}
              <div className="mt-4 flex justify-end gap-3">
                <button className="rounded border border-[var(--border-light)] px-4 py-2 text-sm text-[var(--text-high)]" onClick={() => setRefundMode(null)} disabled={processingRefund}>Cancel</button>
                <button className="rounded bg-red-500 px-4 py-2 text-sm font-medium text-[var(--text-primary)] disabled:opacity-45" onClick={processRefund} disabled={processingRefund || selectedItems.length === 0}>
                  {processingRefund ? "Processing..." : "Confirm Refund"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div className="mx-4 w-full max-w-2xl max-h-[90vh] overflow-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-2xl backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                Print Preview &mdash; {preview.mode === "A4" ? "A4 Receipt" : "POS Receipt"}
              </h3>
              <button className="rounded border border-[var(--border-light)] px-3 py-1 text-sm text-[var(--text-default)]" onClick={() => setPreview(null)}>
                Close
              </button>
            </div>

            <div className="rounded bg-white p-6 text-sm text-[#221e1e]" style={{ maxWidth: preview.mode === "POS" ? "320px" : "100%", fontFamily: preview.mode === "POS" ? "monospace" : "inherit" }}>
              <div className={preview.mode === "POS" ? "" : "text-center border-b-2 border-[#ffe900] pb-3 mb-4"}>
                <p className="font-bold">{preview.sale.receiptNumber ?? preview.sale.id.slice(0, 12)}</p>
              </div>
              <div className="grid gap-1 text-xs mb-3">
                <p><strong>Salesperson:</strong> {preview.sale.user?.displayName ?? "N/A"} ({preview.sale.user?.staffId ?? ""})</p>
                <p><strong>Date:</strong> {new Date(preview.sale.createdAt).toLocaleString()}</p>
                {preview.sale.customer && <p><strong>Customer:</strong> {preview.sale.customer.name}{preview.sale.customer.phone?.startsWith("vip") ? " (VIP)" : ` (${preview.sale.customer.phone})`}</p>}
              </div>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gray-300"><th className="text-left py-1">Item</th><th className="text-center py-1">Qty</th><th className="text-right py-1">Price</th><th className="text-right py-1">Total</th></tr></thead>
                <tbody>
                  {preview.sale.items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-200">
                      <td className="py-1">{item.product.name}</td>
                      <td className="text-center py-1">{item.quantity}</td>
                      <td className="text-right py-1">{money(item.unitPrice)}</td>
                      <td className="text-right py-1">{money(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 ml-auto w-48 text-xs">
                <div className="flex justify-between"><span>Subtotal</span><span>{money(preview.sale.subtotal)}</span></div>
                {preview.sale.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{money(preview.sale.discount)}</span></div>}
                <div className="flex justify-between"><span>Tax</span><span>{money(preview.sale.tax)}</span></div>
                <div className="flex justify-between font-bold border-t border-gray-400 pt-1 mt-1"><span>Total</span><span>{money(preview.sale.totalAmount)}</span></div>
              </div>
              {preview.sale.loyaltyPointsEarned > 0 && <p className="text-xs text-gray-500 mt-2">Points: +{preview.sale.loyaltyPointsEarned}</p>}
              <div className="mt-4 text-center text-[9px] text-gray-400 border-t border-gray-300 pt-2">
                Powered by Avro POS v2.0.3.12<br />
                Developed by Mehedi Pathan
              </div>
            </div>

            <div className="mt-4 flex justify-center gap-3">
              <button className="rounded border border-[var(--border-light)] px-5 py-2 text-sm text-[var(--text-high)]" onClick={() => setPreview(null)}>
                Cancel
              </button>
              <button className="rounded bg-teal px-5 py-2 text-sm font-medium text-ink" onClick={doPrint}>
                Print {preview.mode === "A4" ? "A4" : "POS"}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}