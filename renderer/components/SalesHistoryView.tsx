"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { avroApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { Sale } from "@/lib/types";

function bdMoney(amount: number) {
  return new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", minimumFractionDigits: 2 }).format(amount);
}

interface FilterOptions {
  searchQuery: string;
  startDate: string;
  endDate: string;
  paymentMethod: string;
  salesperson: string;
}

export function SalesHistoryView() {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    searchQuery: "",
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    paymentMethod: "",
    salesperson: ""
  });
  const [viewMode, setViewMode] = useState<"list" | "cards">("list");

  useEffect(() => {
    async function fetchSales() {
      try {
        setLoading(true);
        const data = await avroApi().listSales(500);
        setSales(data);
      } catch (err) {
        console.error("Failed to fetch sales:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSales();
  }, []);

  const todaySales = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return sales.filter((sale) => {
      const saleDate = new Date(sale.createdAt);
      return saleDate >= today && saleDate < tomorrow;
    });
  }, [sales]);

  const todayStats = useMemo(() => {
    return {
      totalSales: todaySales.length,
      totalRevenue: todaySales.reduce((sum, s) => sum + s.totalAmount, 0),
      totalDiscount: todaySales.reduce((sum, s) => sum + s.discount, 0),
      totalTax: todaySales.reduce((sum, s) => sum + s.tax, 0),
      totalItems: todaySales.reduce((sum, s) => sum + s.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0)
    };
  }, [todaySales]);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const saleDate = new Date(sale.createdAt).toISOString().split("T")[0];

      // Date range filter
      if (saleDate < filters.startDate || saleDate > filters.endDate) return false;

      // Payment method filter
      if (filters.paymentMethod && sale.paymentMethod !== filters.paymentMethod) return false;

      // Salesperson filter
      if (filters.salesperson && sale.user?.staffId !== filters.salesperson) return false;

      // Search query
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        return (
          sale.receiptNumber?.toLowerCase().includes(query) ||
          sale.customer?.name.toLowerCase().includes(query) ||
          sale.customer?.phone.includes(query) ||
          sale.user?.displayName.toLowerCase().includes(query) ||
          sale.id.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [sales, filters]);

  const stats = useMemo(() => {
    return {
      totalSales: filteredSales.length,
      totalRevenue: filteredSales.reduce((sum, s) => sum + s.totalAmount, 0),
      totalDiscount: filteredSales.reduce((sum, s) => sum + s.discount, 0),
      totalTax: filteredSales.reduce((sum, s) => sum + s.tax, 0),
      totalItems: filteredSales.reduce((sum, s) => sum + s.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0),
      avgTransactionValue: filteredSales.length > 0 ? filteredSales.reduce((sum, s) => sum + s.totalAmount, 0) / filteredSales.length : 0
    };
  }, [filteredSales]);

  const paymentMethods = useMemo(() => {
    return Array.from(new Set(sales.filter(s => s.paymentMethod).map(s => s.paymentMethod!)));
  }, [sales]);

  const salespersons = useMemo(() => {
    const unique = new Map();
    sales.forEach(s => {
      if (s.user?.staffId && !unique.has(s.user.staffId)) {
        unique.set(s.user.staffId, s.user.displayName);
      }
    });
    return Array.from(unique.entries());
  }, [sales]);

  const handlePrintReceipt = (sale: Sale) => {
    avroApi().getSettings().then((settings) => {
      const fmt = (n: number) => `${settings.currencySymbol}${n.toFixed(2)}`;
      const itemsHtml = sale.items.map((item) => {
        const sku = item.product?.sku ?? "";
        const batch = item.productBatch ?? "";
        const itemDiscount = item.itemDiscountAmount ?? 0;
        const vatRate = item.vatRate ?? 0;
        const vatAmount = item.vatAmount ?? 0;
        return `<tr><td style="padding:6px 8px">${item.product.name}${sku ? ` <small style="color:#666;font-size:11px">[${sku}]</small>` : ""}${batch ? ` <small style="color:#666;font-size:11px">(Batch:${batch})</small>` : ""}</td><td style="padding:6px 8px;text-align:center">${item.quantity}</td><td style="padding:6px 8px;text-align:right">${fmt(item.unitPrice)}</td><td style="padding:6px 8px;text-align:right">${itemDiscount > 0 ? `-${fmt(itemDiscount)}` : "-"}</td><td style="padding:6px 8px;text-align:right">${vatRate}%</td><td style="padding:6px 8px;text-align:right">${fmt(vatAmount)}</td><td style="padding:6px 8px;text-align:right">${fmt(item.lineTotal)}</td></tr>`;
      }).join("");

      const logoHtml = settings.businessLogoPath ? `<img src="${settings.businessLogoPath}" alt="logo" style="height:56px;object-fit:contain;margin-bottom:8px"/>` : "";
      const headerExtra = [];
      if (settings.binNumber) headerExtra.push(`BIN: ${settings.binNumber}`);
      if (settings.tinNumber) headerExtra.push(`TIN: ${settings.tinNumber}`);
      if (settings.tradeLicenseNumber) headerExtra.push(`Trade: ${settings.tradeLicenseNumber}`);
      const headerMeta = headerExtra.length ? ` | ${headerExtra.join(' | ')}` : "";

      const html = `<!DOCTYPE html>
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
  .footer { text-align:center; margin-top:24px; padding-top:12px; border-top:1px solid #ddd; font-size:10px; color:#999; line-height:1.5 }
</style></head><body>
<div class="header">
  ${logoHtml}
  <h1>${settings.businessName}</h1>
  <p>${settings.branchName ?? settings.businessName} • ${settings.branchAddress ?? settings.address}${headerMeta}</p>
  <p>${settings.verifiedPhone ?? ''}${settings.email ? ` • ${settings.email}` : ''}${settings.website ? ` • ${settings.website}` : ''}</p>
</div>
<div class="meta">
  <div><strong>Receipt:</strong> ${sale.receiptNumber ?? sale.id.slice(0, 12)}<br><strong>Date:</strong> ${new Date(sale.createdAt).toLocaleString()}</div>
  <div style="text-align:right"><strong>Salesperson:</strong> ${sale.user?.displayName ?? "N/A"}<br><strong>Staff ID:</strong> ${sale.user?.staffId ?? "N/A"}</div>
</div>
${sale.customer ? `<p style="font-size:12px;margin-bottom:10px"><strong>Customer:</strong> ${sale.customer.name} — ${sale.customer.phone}</p>` : ""}
<table><thead><tr><th>Item</th><th style="width:50px;text-align:center">Qty</th><th style="width:80px;text-align:right">Unit</th><th style="width:80px;text-align:right">ItemDisc</th><th style="width:80px;text-align:right">VAT%</th><th style="width:80px;text-align:right">VAT Amt</th><th style="width:100px;text-align:right">Line Total</th></tr></thead>
<tbody>${itemsHtml}</tbody></table>
<table class="totals">
  <tr><td>Subtotal</td><td style="text-align:right">${fmt(sale.subtotal)}</td></tr>
      ${sale.discount > 0 ? `<tr><td>Invoice Discount</td><td style="text-align:right">-${fmt(sale.discount)}</td></tr>` : ""}
      <tr><td>VAT Total</td><td style="text-align:right">${fmt(sale.tax)}</td></tr>
      <tr class="final"><td>Total</td><td style="text-align:right">${fmt(sale.totalAmount)}</td></tr>
</table>
${sale.loyaltyPointsEarned > 0 ? `<p style="font-size:11px;color:#666">Loyalty points earned: ${sale.loyaltyPointsEarned}</p>` : ""}
<div style="margin-top:14px;display:flex;justify-content:space-between;align-items:flex-start">
  <div style="font-size:12px;color:#444">
    <p><strong>Payment:</strong> ${sale.paymentMethod ?? 'Cash'}</p>
    ${sale.payments && sale.payments.length ? `<p><strong>Transaction ID:</strong> ${sale.payments[0].transactionId ?? '-'}</p><p><strong>Payment Status:</strong> ${sale.payments[0].status ?? '-'}</p>` : (sale.transactionId ? `<p><strong>Transaction ID:</strong> ${sale.transactionId}</p>` : '')}
    <p><strong>Terminal ID:</strong> ${sale.terminalId ?? '-'} • <strong>Cashier:</strong> ${sale.user?.staffId ?? sale.user?.displayName ?? '-'}</p>
    <p><strong>Branch ID:</strong> ${sale.branchId ?? '-'} • <strong>Shift:</strong> ${sale.shiftNumber ?? '-'}</p>
  </div>
  <div style="text-align:center">
    <img src="https://chart.googleapis.com/chart?chs=120x120&cht=qr&chl=${encodeURIComponent(`https://verify.avro-pos.local/sale/${sale.id}`)}&choe=UTF-8" alt="QR" style="height:100px;width:100px;border:1px solid #eee;padding:6px;background:#fff" />
    <div style="font-size:11px;color:#666;margin-top:6px">Scan to verify invoice</div>
  </div>
</div>
<div class="footer">শর্তাবলী ও নির্দেশনাবলী: ডেলিভারি গ্রহণের সময় পণ্যটি ভালো করে দেখে বুঝে নিন, পরবর্তীতে ফিজিক্যাল ড্যামেজ সংক্রান্ত কোনো অভিযোগ গ্রহণযোগ্য হবে না। পণ্য কেনার পূর্বে সংশ্লিষ্ট ব্র্যান্ডের ওয়ারেন্টি ও গ্যারান্টির শর্তসমূহ বিক্রয়কর্মীর নিকট থেকে জেনে নিন। বিক্রিত পণ্য সাধারণত ফেরত নেওয়া হয় না, তবে বিশেষ ক্ষেত্রে বক্স ও মেমো অক্ষত থাকা সাপেক্ষে ২৪ ঘণ্টার মধ্যে পরিবর্তন করা যেতে পারে। বিশেষ প্রয়োজনে বা ওয়ারেন্টি দাবির ক্ষেত্রে এই মেমো ও মূল বক্স অবশ্যই সাথে আনতে হবে। মেমো ব্যতীত কোনো দাবি বা অভিযোগ গ্রহণযোগ্য নয়। ইনভয়েসে অনিচ্ছাকৃত কোনো হিসাবের ভুল পরিলক্ষিত হলে তা সংশোধনের পূর্ণ ক্ষমতা কর্তৃপক্ষ সংরক্ষণ করে।</div>
<script>window.print();</script></body></html>`;

      const printWindow = window.open("", "", "width=800,height=600");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
      }
    });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-default)] border-t-[var(--accent-primary)]"></div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1 scrollable">
      {/* Header */}
      <div className="flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Sales History</h1>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">Complete record of all sales transactions and revenue.</p>
        </div>
      </div>

      {/* Today's Stats Cards */}
      <div className="rounded-2xl border border-[var(--glass-border)] p-5 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 shrink-0">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Today&apos;s Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-lg bg-white/60 dark:bg-black/20 p-3 backdrop-blur-sm">
              <p className="text-xs text-[var(--text-muted)] font-medium">Total Sales</p>
              <p className="text-lg font-bold text-[var(--text-primary)] mt-1">{todayStats.totalSales}</p>
            </div>
            <div className="rounded-lg bg-white/60 dark:bg-black/20 p-3 backdrop-blur-sm">
              <p className="text-xs text-[var(--text-muted)] font-medium">Revenue</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400 mt-1">{bdMoney(todayStats.totalRevenue)}</p>
            </div>
            <div className="rounded-lg bg-white/60 dark:bg-black/20 p-3 backdrop-blur-sm">
              <p className="text-xs text-[var(--text-muted)] font-medium">Items Sold</p>
              <p className="text-lg font-bold text-[var(--text-primary)] mt-1">{todayStats.totalItems}</p>
            </div>
            <div className="rounded-lg bg-white/60 dark:bg-black/20 p-3 backdrop-blur-sm">
              <p className="text-xs text-[var(--text-muted)] font-medium">Discount</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400 mt-1">{bdMoney(todayStats.totalDiscount)}</p>
            </div>
            <div className="rounded-lg bg-white/60 dark:bg-black/20 p-3 backdrop-blur-sm">
              <p className="text-xs text-[var(--text-muted)] font-medium">Tax</p>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">{bdMoney(todayStats.totalTax)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="rounded-2xl border border-[var(--glass-border)] p-5 shrink-0 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Filters & Search</h3>

        {/* Search Bar */}
        <input
          type="text"
          placeholder="Search by receipt #, customer name, phone, or staff..."
          value={filters.searchQuery}
          onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
          className="w-full px-4 py-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] text-sm transition-all"
        />

        {/* Date Range & Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Payment Method</label>
            <select
              value={filters.paymentMethod}
              onChange={(e) => setFilters(prev => ({ ...prev, paymentMethod: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            >
              <option value="">All Methods</option>
              {paymentMethods.map((method) => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Salesperson</label>
            <select
              value={filters.salesperson}
              onChange={(e) => setFilters(prev => ({ ...prev, salesperson: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            >
              <option value="">All Salespersons</option>
              {salespersons.map(([staffId, displayName]) => (
                <option key={staffId} value={staffId}>{displayName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* View Mode Toggle & Stats */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text-primary)]">{filteredSales.length}</span> sales found
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === "list" ? "bg-[var(--accent-primary)] text-white" : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]"}`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === "cards" ? "bg-[var(--accent-primary)] text-white" : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]"}`}
            >
              Cards
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
        <div className="rounded-xl border border-[var(--glass-border)] p-4 bg-[var(--bg-card)]">
          <p className="text-xs font-medium text-[var(--text-muted)]">Total Revenue</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-2">{bdMoney(stats.totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-[var(--glass-border)] p-4 bg-[var(--bg-card)]">
          <p className="text-xs font-medium text-[var(--text-muted)]">Transactions</p>
          <p className="text-xl font-bold text-[var(--text-primary)] mt-2">{stats.totalSales}</p>
        </div>
        <div className="rounded-xl border border-[var(--glass-border)] p-4 bg-[var(--bg-card)]">
          <p className="text-xs font-medium text-[var(--text-muted)]">Items Sold</p>
          <p className="text-xl font-bold text-[var(--text-primary)] mt-2">{stats.totalItems}</p>
        </div>
        <div className="rounded-xl border border-[var(--glass-border)] p-4 bg-[var(--bg-card)]">
          <p className="text-xs font-medium text-[var(--text-muted)]">Avg Transaction</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-2">{bdMoney(stats.avgTransactionValue)}</p>
        </div>
        <div className="rounded-xl border border-[var(--glass-border)] p-4 bg-[var(--bg-card)]">
          <p className="text-xs font-medium text-[var(--text-muted)]">Total Discount</p>
          <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-2">{bdMoney(stats.totalDiscount)}</p>
        </div>
      </div>

      {/* Sales List/Cards */}
      <div className="space-y-3 flex-1">
        {filteredSales.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-default)] p-12 text-center">
            <svg className="h-12 w-12 text-[var(--text-muted)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-[var(--text-muted)]">No sales found</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Try adjusting your filters</p>
          </div>
        ) : viewMode === "list" ? (
          <div className="overflow-x-auto rounded-xl border border-[var(--border-default)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border-default)]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)]">Receipt #</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)]">Customer</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)]">Salesperson</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)]">Items</th>
                  <th className="px-4 py-3 text-right font-semibold text-[var(--text-muted)]">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--text-muted)]">Date/Time</th>
                  <th className="px-4 py-3 text-center font-semibold text-[var(--text-muted)]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                <AnimatePresence>
                  {filteredSales.map((sale, index) => (
                    <motion.tr
                      key={sale.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-[var(--bg-secondary)] transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-[var(--accent-primary)]">{sale.receiptNumber ?? sale.id.slice(0, 8)}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">{sale.customer?.name ?? "Walk-in"}</p>
                          <p className="text-xs text-[var(--text-muted)]">{sale.customer?.phone ?? "—"}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{sale.user?.displayName ?? "—"}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{sale.items.length} items</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600 dark:text-green-400">{bdMoney(sale.totalAmount)}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">{new Date(sale.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handlePrintReceipt(sale)}
                          className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] font-medium text-xs px-2 py-1 rounded hover:bg-[var(--bg-secondary)] transition-colors"
                        >
                          Print
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filteredSales.map((sale) => (
                <motion.div
                  key={sale.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="rounded-xl border border-[var(--glass-border)] p-4 bg-[var(--bg-card)] hover:border-[var(--accent-primary)] hover:shadow-lg transition-all cursor-pointer"
                  onClick={() => setSelectedSale(sale)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs font-mono text-[var(--accent-primary)]">{sale.receiptNumber ?? sale.id.slice(0, 8)}</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">{sale.customer?.name ?? "Walk-in Customer"}</p>
                    </div>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">{bdMoney(sale.totalAmount)}</p>
                  </div>
                  <div className="space-y-1.5 border-t border-[var(--border-default)] pt-3 mb-3 text-xs text-[var(--text-muted)]">
                    <div className="flex justify-between">
                      <span>Items:</span>
                      <span className="font-medium">{sale.items.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Salesperson:</span>
                      <span className="font-medium">{sale.user?.displayName ?? "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Payment:</span>
                      <span className="font-medium">{sale.paymentMethod ?? "—"}</span>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mb-3">{new Date(sale.createdAt).toLocaleString()}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrintReceipt(sale);
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
                  >
                    Print Receipt
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Sale Details Modal */}
      <AnimatePresence>
        {selectedSale && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setSelectedSale(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-default)] p-6 max-w-2xl w-full max-h-96 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">Sale Receipt</h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">#{selectedSale.receiptNumber ?? selectedSale.id.slice(0, 12)}</p>
                </div>
                <button
                  onClick={() => setSelectedSale(null)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 border-b border-[var(--border-default)] pb-4 mb-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-[var(--text-muted)] font-medium mb-0.5">Customer</p>
                    <p className="font-medium text-[var(--text-primary)]">{selectedSale.customer?.name ?? "Walk-in"}</p>
                    {selectedSale.customer?.phone && <p className="text-xs text-[var(--text-muted)]">{selectedSale.customer.phone}</p>}
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-muted)] font-medium mb-0.5">Date & Time</p>
                    <p className="font-medium text-[var(--text-primary)]">{new Date(selectedSale.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-muted)] font-medium mb-0.5">Salesperson</p>
                    <p className="font-medium text-[var(--text-primary)]">{selectedSale.user?.displayName ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-muted)] font-medium mb-0.5">Payment Method</p>
                    <p className="font-medium text-[var(--text-primary)]">{selectedSale.paymentMethod ?? "—"}</p>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Items</h3>
                <div className="space-y-2 text-xs">
                  {selectedSale.items.map((item) => (
                    <div key={item.id} className="flex justify-between pb-2 border-b border-[var(--border-default)]">
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{item.product.name}</p>
                        <p className="text-[var(--text-muted)]">SKU: {item.product.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-[var(--text-primary)]">{item.quantity} × {bdMoney(item.unitPrice)}</p>
                        <p className="text-[var(--text-muted)]">{bdMoney(item.lineTotal)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 border-t border-[var(--border-default)] pt-3 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Subtotal</span>
                  <span className="font-medium text-[var(--text-primary)]">{bdMoney(selectedSale.subtotal)}</span>
                </div>
                {selectedSale.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Discount</span>
                    <span className="font-medium text-red-600 dark:text-red-400">-{bdMoney(selectedSale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Tax</span>
                  <span className="font-medium text-[var(--text-primary)]">{bdMoney(selectedSale.tax)}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--border-default)] pt-2">
                  <span className="font-semibold text-[var(--text-primary)]">Total</span>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">{bdMoney(selectedSale.totalAmount)}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  handlePrintReceipt(selectedSale);
                  setSelectedSale(null);
                }}
                className="w-full px-4 py-2.5 rounded-lg bg-[var(--accent-primary)] text-white font-medium hover:opacity-90 transition-opacity"
              >
                Print Receipt
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
