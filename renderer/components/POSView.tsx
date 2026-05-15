"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { money } from "@/components/Money";
import { useAuth } from "@/hooks/useAuth";
import { avroApi } from "@/lib/api";
import type { BusinessSettings, Customer, Product, Sale } from "@/lib/types";
import { useCart } from "@/store/useCart";
import { APP_VERSION } from "@/lib/version";

export function POSView() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [sku, setSku] = useState("");
  const [scanMode, setScanMode] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: "", phone: "", email: "", isVip: false });
  const [message, setMessage] = useState("");
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const cart = useCart();
  const scanRef = useRef<HTMLInputElement>(null);
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanBuffer = useRef("");

  async function loadData() {
    const [nextProducts, nextCustomers, settings] = await Promise.all([
      avroApi().getProducts(), avroApi().listCustomers(), avroApi().getSettings()
    ]);
    setProducts(nextProducts);
    setCustomers(nextCustomers);
    const rate = parseFloat((settings as unknown as BusinessSettings).taxRate ?? "5");
    if (!isNaN(rate) && rate > 0) cart.setTaxRate(rate);
  }

  useEffect(() => { loadData().catch((error) => setMessage(error.message)); }, []);

  useEffect(() => { if (scanMode && scanRef.current) scanRef.current.focus(); }, [scanMode]);

  const handleScanInput = useCallback((value: string) => {
    scanBuffer.current += value;
    if (scanTimer.current) clearTimeout(scanTimer.current);
    scanTimer.current = setTimeout(() => {
      const code = scanBuffer.current.trim();
      scanBuffer.current = "";
      if (code) {
        const found = cart.addBySku(code, products);
        if (!found) setMessage(`No product found for barcode/SKU: ${code}`);
        else setMessage("");
      }
    }, 150);
  }, [cart, products]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((product) =>
      [product.sku, product.name, product.category ?? ""].some((value) => value.toLowerCase().includes(needle))
    );
  }, [products, query]);

  function addSku(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const found = cart.addBySku(sku, products);
    setSku("");
    if (!found) setMessage("No product found for that SKU.");
  }

  function isValidBangladeshiPhone(phone: string) {
    const cleaned = phone.replace(/[\s-]/g, "");
    if (/^\+8801\d{9}$/.test(cleaned) && cleaned.length === 14) return true;
    return false;
  }

  function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function addCustomer(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const phoneTrimmed = customerForm.phone.trim();
    const emailTrimmed = customerForm.email.trim();

    if (!customerForm.name.trim()) {
      setMessage("Full name is required.");
      return;
    }

    if (!customerForm.isVip) {
      if (!phoneTrimmed) {
        setMessage("Phone number is required. For VIP customers, enable the VIP option.");
        return;
      }
      if (!isValidBangladeshiPhone(phoneTrimmed)) {
        setMessage("Phone must be +8801XXXXXXXXX (14 characters including +880).");
        return;
      }
    }

    if (emailTrimmed && !isValidEmail(emailTrimmed)) {
      setMessage("Please enter a valid email address.");
      return;
    }

    try {
      const phone = customerForm.isVip && !phoneTrimmed
        ? `vip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        : phoneTrimmed;

      const payload = {
        actorId: user?.id,
        name: customerForm.name.trim(),
        phone,
        email: emailTrimmed || null,
        isVip: customerForm.isVip
      };

      const customer = await avroApi().upsertCustomer(payload);
      cart.setCustomer({ ...customer, isVip: customerForm.isVip });
      setCustomerForm({ name: "", phone: "", email: "", isVip: false });
      setCustomers(await avroApi().listCustomers());
      setMessage(customerForm.isVip ? "VIP customer attached." : "Customer attached.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not attach customer.");
    }
  }

  async function completeSale() {
    setMessage("");
    setLastSale(null);
    try {
      const saleId = await avroApi().processSale({
        userId: user?.id,
        actorId: user?.id,
        customerId: cart.customer?.id,
        taxRate: cart.taxRate / 100,
        discount: cart.discount,
        items: cart.lines.map((line) => ({ productId: line.product.id, quantity: line.quantity }))
      }) as { id: string };
      cart.clear();
      await loadData();
      const fullSale = await avroApi().getSale(saleId.id);
      setLastSale(fullSale);
      setMessage(`Sale completed. Receipt: ${fullSale.id.slice(0, 12)}...`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sale failed.");
    }
  }

  return (
    <div className="flex h-full w-full gap-0 overflow-hidden">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-[var(--border-default)] bg-[var(--bg-input-ghost)] px-5 py-3">
          <div className="relative flex flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-[var(--text-muted)] transition-all focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-teal/10"
              placeholder="Search products across SKU, name, category..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <form className="flex gap-2" onSubmit={addSku}>
            <input
              className={`rounded-lg border bg-[var(--bg-input)] px-3 py-2.5 text-sm text-ink placeholder:text-[var(--text-muted)] w-40 ${
                scanMode ? "border-teal ring-1 ring-teal/30" : "border-[var(--border-default)]"
              }`}
              placeholder="Scan SKU"
              value={sku}
              onChange={(event) => setSku(event.target.value)}
            />
            <button
              type="submit"
              className="rounded-lg bg-teal px-4 py-2.5 text-sm font-medium text-ink transition-all hover:bg-teal/80"
            >
              Add
            </button>
          </form>
          <button
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm transition-all ${
              scanMode
                ? "border-teal bg-teal/10 text-teal"
                : "border-[var(--border-light)] text-[var(--text-default)] hover:bg-[var(--bg-card)]"
            }`}
            onClick={() => setScanMode(!scanMode)}
            title="Toggle barcode scanner mode"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            {scanMode ? "Scanning" : "Scanner"}
          </button>
          {scanMode ? (
            <input
              ref={scanRef}
              className="absolute -left-full"
              autoFocus
              onChange={(e) => {
                handleScanInput(e.target.value);
                e.target.value = "";
              }}
            />
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
            <AnimatePresence>
              {filtered.map((product) => (
                <motion.button
                  key={product.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="group flex flex-col rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 text-left shadow-sm backdrop-blur-xl transition-all hover:border-teal/30 hover:bg-[var(--bg-card-hover)] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={product.stockLevel <= 0}
                  onClick={() => cart.addProduct(product)}
                >
                  <div className="flex-1">
                    <p className="font-semibold text-[var(--text-primary)] group-hover:text-teal transition-colors text-sm leading-snug">{product.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--text-tertiary)]">
                      <span className="font-mono">{product.sku}</span>
                      <span className="text-[var(--text-muted)]">|</span>
                      <span className="text-[var(--text-secondary)]">
                        {product.subcategory
                          ? `${product.subcategory.category.name} › ${product.subcategory.name}`
                          : (product.category ?? "Uncategorized")}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="rounded bg-teal/15 px-2 py-0.5 text-xs font-bold text-teal">{money(product.price)}</span>
                    <span className={`text-xs font-medium tabular-nums ${
                      product.stockLevel <= product.lowStockAt ? "text-amber-400" : "text-emerald-300"
                    }`}>
                      {product.stockLevel} left
                    </span>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
          {filtered.length === 0 && (
            <div className="flex items-center justify-center py-20">
              <p className="text-sm text-[var(--text-muted)]">No products found.</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {sidebarCollapsed && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-l border border-[var(--border-default)] bg-[var(--bg-card)] p-2 text-[var(--text-mid)] hover:text-[var(--text-primary)]"
            onClick={() => setSidebarCollapsed(false)}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      <motion.aside
        animate={{ width: sidebarCollapsed ? 0 : 300 }}
        className="flex h-full shrink-0 flex-col overflow-hidden border-l border-[var(--border-default)] bg-[var(--bg-card)] backdrop-blur-xl"
        style={{ minWidth: 0 }}
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Cart</h2>
            <button
              className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              onClick={() => setSidebarCollapsed(true)}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="border-b border-[var(--border-default)] p-4">
            <select
              className="w-full rounded bg-[var(--bg-input)] px-3 py-2 text-sm text-ink"
              value={cart.customer?.id ?? ""}
              onChange={(event) => cart.setCustomer(customers.find((customer) => customer.id === event.target.value) ?? null)}
            >
              <option value="">Walk-in customer</option>
              {customers.map((customer) => {
                const vip = customer.phone?.startsWith("vip-");
                return (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}{vip ? " (VIP)" : ""} ({customer.points} pts)
                  </option>
                );
              })}
            </select>
          </div>

          <form className="border-b border-[var(--border-default)] p-4" onSubmit={addCustomer}>
            <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Quick add customer</p>
            <div className="grid gap-2">
              <input className="rounded bg-[var(--bg-input)] px-3 py-2 text-sm text-ink" placeholder="Full name *" value={customerForm.name} onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })} required />
              {customerForm.isVip ? (
                <>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 text-xs text-ink/40">+880</span>
                    <input className="w-full rounded bg-[var(--bg-input)] py-2 pl-10 pr-3 text-sm text-ink" placeholder="1XXXXXXXXX (optional)" value={customerForm.phone.replace("+880", "")} onChange={(event) => setCustomerForm({ ...customerForm, phone: "+880" + event.target.value.replace(/\D/g, "").slice(0, 10) })} />
                  </div>
                  <input className="rounded bg-[var(--bg-input)] px-3 py-2 text-sm text-ink" placeholder="Email (optional)" value={customerForm.email} onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })} />
                </>
              ) : (
                <>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 text-xs text-ink/40">+880</span>
                    <input className="w-full rounded bg-[var(--bg-input)] py-2 pl-10 pr-3 text-sm text-ink" placeholder="1XXXXXXXXX" value={customerForm.phone.replace("+880", "")} onChange={(event) => setCustomerForm({ ...customerForm, phone: "+880" + event.target.value.replace(/\D/g, "").slice(0, 10) })} required={!customerForm.isVip} />
                  </div>
                  <input className="rounded bg-[var(--bg-input)] px-3 py-2 text-sm text-ink" placeholder="Email (optional)" value={customerForm.email} onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })} />
                </>
              )}
              <label className="flex items-center gap-2 text-xs text-[var(--text-mid)]">
                <input type="checkbox" checked={customerForm.isVip} onChange={(e) => setCustomerForm({ ...customerForm, isVip: e.target.checked })} />
                VIP &mdash; hide personal details
              </label>
              <button className="rounded border border-[var(--border-light)] px-3 py-2 text-xs">{customerForm.isVip ? "Add VIP" : "Attach customer"}</button>
            </div>
          </form>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.lines.length ? cart.lines.map((line) => (
              <div key={line.product.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{line.product.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{money(line.product.price)} each</p>
                </div>
                <input className="w-16 shrink-0 rounded bg-[var(--bg-input)] px-2 py-1 text-right text-sm text-ink" type="number" min={1} max={line.product.stockLevel} value={line.quantity} onChange={(event) => cart.setQuantity(line.product.id, Number(event.target.value))} />
                <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[var(--border-light)] text-xs text-[var(--text-mid)] hover:text-red-400" onClick={() => cart.removeProduct(line.product.id)}>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )) : (
              <p className="text-sm text-[var(--text-muted)] text-center py-8">Cart is empty</p>
            )}
          </div>

          <div className="border-t border-[var(--border-default)] p-4 space-y-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-[var(--text-default)]"><span>Subtotal</span><span>{money(cart.subtotal())}</span></div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--text-default)]">Discount</span>
                <input className="w-24 rounded bg-[var(--bg-input)] px-2 py-1 text-right text-sm text-ink" type="number" min={0} step="0.01" value={cart.discount} onChange={(event) => cart.setDiscount(Number(event.target.value))} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--text-default)]">Tax %</span>
                <input className="w-16 rounded bg-[var(--bg-input)] px-2 py-1 text-right text-sm text-ink" type="number" min={0} max={100} step="0.1" value={cart.taxRate} onChange={(event) => cart.setTaxRate(Number(event.target.value))} />
              </div>
              <div className="flex justify-between border-t border-[var(--border-default)] pt-2 text-base font-bold text-[var(--text-primary)]"><span>Total</span><span>{money(cart.total())}</span></div>
            </div>
            {message ? <p className="text-xs text-[var(--text-message)]">{message}</p> : null}
            <div className="grid grid-cols-2 gap-2">
              <button className="rounded border border-[var(--border-light)] px-4 py-3 text-sm font-semibold text-[var(--text-default)] disabled:opacity-45" disabled={!cart.lines.length} onClick={() => cart.parkCart()}>Park</button>
              <button className="rounded bg-teal px-4 py-3 text-sm font-semibold text-ink disabled:opacity-45" disabled={!cart.lines.length} onClick={completeSale}>Complete</button>
            </div>
            {cart.parkedCarts.length ? (
              <div className="flex flex-wrap gap-2">
                {cart.parkedCarts.map((parked) => (
                  <button className="rounded border border-[var(--border-light)] px-2 py-1 text-xs text-[var(--text-mid)]" key={parked.id} onClick={() => cart.restoreCart(parked.id)}>{parked.label}</button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </motion.aside>

      <AnimatePresence>
        {lastSale && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setLastSale(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="mx-4 w-full max-w-lg rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-2xl backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  Receipt &mdash; {lastSale.receiptNumber ?? lastSale.id.slice(0, 12)}
                </h3>
                <button className="rounded border border-[var(--border-light)] px-3 py-1 text-sm text-[var(--text-default)]" onClick={() => setLastSale(null)}>
                  Close
                </button>
              </div>

              <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">Salesperson</p>
                  <p className="font-medium text-[var(--text-primary)]">{lastSale.user?.displayName ?? "N/A"}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{lastSale.user?.staffId ?? ""}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">Date &amp; Time</p>
                  <p className="font-medium text-[var(--text-primary)]">{new Date(lastSale.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">Customer</p>
                  <p className="font-medium text-[var(--text-primary)]">{lastSale.customer?.name ?? "Walk-in"}</p>
                  {lastSale.customer && !lastSale.customer.phone?.startsWith("vip") && <p className="text-xs text-[var(--text-secondary)]">{lastSale.customer.phone}</p>}
                  {lastSale.customer?.phone?.startsWith("vip") && <p className="text-xs text-[var(--text-secondary)]">VIP</p>}
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">Receipt #</p>
                  <p className="font-mono text-xs text-[var(--text-default)]">{lastSale.receiptNumber ?? lastSale.id.slice(0, 12)}</p>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto rounded border border-[var(--border-default)]">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-[var(--bg-card)] text-[var(--text-mid)] text-xs">
                    <tr>
                      <th className="p-2 font-medium">Item</th>
                      <th className="p-2 font-medium text-center">Qty</th>
                      <th className="p-2 font-medium text-right">Price</th>
                      <th className="p-2 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastSale.items.map((item) => (
                      <tr key={item.id} className="border-t border-[var(--border-default)]">
                        <td className="p-2 text-[var(--text-primary)]">{item.product.name}</td>
                        <td className="p-2 text-center text-[var(--text-high)]">{item.quantity}</td>
                        <td className="p-2 text-right text-[var(--text-high)]">{money(item.unitPrice)}</td>
                        <td className="p-2 text-right text-[var(--text-primary)] font-medium">{money(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 ml-auto w-56 space-y-1 text-sm">
                <div className="flex justify-between text-[var(--text-default)]">
                  <span>Subtotal</span>
                  <span>{money(lastSale.subtotal)}</span>
                </div>
                {lastSale.discount > 0 && (
                  <div className="flex justify-between text-[var(--text-default)]">
                    <span>Discount</span>
                    <span>-{money(lastSale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[var(--text-default)]">
                  <span>Tax</span>
                  <span>{money(lastSale.tax)}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--border-default)] pt-1 text-lg font-semibold text-[var(--text-primary)]">
                  <span>Total</span>
                  <span>{money(lastSale.totalAmount)}</span>
                </div>
              </div>

              <div className="mt-4 flex justify-center gap-3 border-t border-[var(--border-default)] pt-4">
                <button className="rounded bg-teal px-4 py-2 text-sm font-medium text-ink" onClick={() => {
                  avroApi().getSettings().then((settings) => {
                    const fmt = (n: number) => `${settings.currencySymbol}${n.toFixed(2)}`;
                    const itemsHtml = lastSale.items.map((item) => {
                      const sku = item.product?.sku ?? "";
                      const batch = item.productBatch ?? "";
                      const itemDiscount = item.itemDiscountAmount ?? 0;
                      const vatRate = item.vatRate ?? 0;
                      const vatAmount = item.vatAmount ?? 0;
                      return `<tr><td style=\"padding:6px 8px\">${item.product.name}${sku ? ` <small style=\\\"color:#666;font-size:11px\\\">[${sku}]</small>` : ""}${batch ? ` <small style=\\\"color:#666;font-size:11px\\\">(Batch:${batch})</small>` : ""}</td><td style=\"padding:6px 8px;text-align:center\">${item.quantity}</td><td style=\"padding:6px 8px;text-align:right\">${fmt(item.unitPrice)}</td><td style=\"padding:6px 8px;text-align:right\">${itemDiscount > 0 ? `-${fmt(itemDiscount)}` : "-"}</td><td style=\"padding:6px 8px;text-align:right\">${vatRate}%</td><td style=\"padding:6px 8px;text-align:right\">${fmt(vatAmount)}</td><td style=\"padding:6px 8px;text-align:right\">${fmt(item.lineTotal)}</td></tr>`;
                    }).join("");
                    const logoHtml = settings.businessLogoPath ? `<img src="${settings.businessLogoPath}" alt="logo" style="height:56px;object-fit:contain;margin-bottom:8px"/>` : "";
                    const headerExtra = [];
                    if (settings.binNumber) headerExtra.push(`BIN: ${settings.binNumber}`);
                    if (settings.tinNumber) headerExtra.push(`TIN: ${settings.tinNumber}`);
                    if (settings.tradeLicenseNumber) headerExtra.push(`Trade: ${settings.tradeLicenseNumber}`);
                    const headerMeta = headerExtra.length ? ` | ${headerExtra.join(' | ')}` : "";

                    const html = /* html */`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt</title><style>
                      @page{size:A4;margin:15mm} body{font-family:'Segoe UI',Arial,sans-serif;color:#17202a;padding:20px}
                      .header{text-align:center;border-bottom:2px solid #ffe900;padding-bottom:14px;margin-bottom:16px}
                      .header h1{margin:0;font-size:22px;color:#221e1e}
                      .meta{display:flex;justify-content:space-between;margin-bottom:14px;font-size:12px;color:#444}
                      table{width:100%;border-collapse:collapse;margin-bottom:14px}
                      th{background:#221e1e;color:#fff;padding:6px;text-align:left;font-size:12px}
                      th:last-child{text-align:right}
                      td{border-bottom:1px solid #ddd;padding:6px;font-size:12px}
                      .totals{width:280px;margin-left:auto}
                      .totals td{border:none;padding:3px 8px}
                      .totals .final td{font-size:15px;font-weight:700;border-top:2px solid #221e1e;padding-top:6px}
                      .footer{text-align:center;margin-top:20px;padding-top:10px;border-top:1px solid #ddd;font-size:10px;color:#999}
                    </style></head><body>
                      <div class="header">${logoHtml}<h1>${settings.businessName}</h1><p>${settings.branchName ?? settings.businessName} • ${settings.branchAddress ?? settings.address}${headerMeta}</p><p>${settings.verifiedPhone ?? ''}${settings.email ? ` • ${settings.email}` : ''}${settings.website ? ` • ${settings.website}` : ''}</p></div>
                      <div class="meta"><div><strong>Receipt:</strong> ${lastSale.receiptNumber ?? lastSale.id}<br><strong>Date:</strong> ${new Date(lastSale.createdAt).toLocaleString()}</div>
                      <div style="text-align:right"><strong>Salesperson:</strong> ${lastSale.user?.displayName ?? "N/A"} (${lastSale.user?.staffId ?? ""})</div></div>
                      ${lastSale.customer ? `<p style="font-size:12px;margin-bottom:8px"><strong>Customer:</strong> ${lastSale.customer.name}${lastSale.customer.phone?.startsWith("vip") ? " (VIP)" : ` &mdash; ${lastSale.customer.phone}`}</p>` : ""}
                      <table><thead><tr><th>Item</th><th style="width:50px;text-align:center">Qty</th><th style="width:80px;text-align:right">Unit</th><th style="width:80px;text-align:right">ItemDisc</th><th style="width:80px;text-align:right">VAT%</th><th style="width:80px;text-align:right">VAT Amt</th><th style="width:100px;text-align:right">Line Total</th></tr></thead><tbody>${itemsHtml}</tbody></table>
                      <table class="totals"><tr><td>Subtotal</td><td style="text-align:right">${fmt(lastSale.subtotal)}</td></tr>
                      ${lastSale.discount > 0 ? `<tr><td>Invoice Discount</td><td style="text-align:right">-${fmt(lastSale.discount)}</td></tr>` : ""}
                      ${lastSale.tax > 0 ? `<tr><td>VAT Total</td><td style="text-align:right">${fmt(lastSale.tax)}</td></tr>` : ""}
                      <tr class="final"><td>Total</td><td style="text-align:right">${fmt(lastSale.totalAmount)}</td></tr></table>
                      <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:flex-start">
                        <div style="font-size:12px;color:#444">
                          <p><strong>Payment:</strong> ${lastSale.paymentMethod ?? 'Cash'}</p>
                          ${lastSale.payments && lastSale.payments.length ? `<p><strong>Transaction ID:</strong> ${lastSale.payments[0].transactionId ?? '-'}</p><p><strong>Payment Status:</strong> ${lastSale.payments[0].status ?? '-'}</p>` : (lastSale.transactionId ? `<p><strong>Transaction ID:</strong> ${lastSale.transactionId}</p>` : '')}
                          <p><strong>Terminal ID:</strong> ${lastSale.terminalId ?? '-'} • <strong>Cashier:</strong> ${lastSale.user?.staffId ?? lastSale.user?.displayName ?? '-'}</p>
                          <p><strong>Branch ID:</strong> ${lastSale.branchId ?? '-'} • <strong>Shift:</strong> ${lastSale.shiftNumber ?? '-'}</p>
                        </div>
                        <div style="text-align:center">
                          <img src="https://chart.googleapis.com/chart?chs=120x120&cht=qr&chl=${encodeURIComponent(settings.website ? `${settings.website.replace(/\/$/, '')}/verify/${lastSale.id}` : `https://verify.avro-pos.local/sale/${lastSale.id}`)}&choe=UTF-8" alt="QR" style="height:100px;width:100px;border:1px solid #eee;padding:6px;background:#fff" />
                          <div style="font-size:11px;color:#666;margin-top:6px">Scan to verify invoice</div>
                        </div>
                      </div>
                      <script>window.print();<\/script></body></html>`;
                    const w = window.open("", "_blank");
                    if (w) { w.document.write(html); w.document.close(); }
                  });
                }}>
                  Print A4
                </button>
                <button className="rounded border border-[var(--border-light)] px-4 py-2 text-sm text-[var(--text-high)]" onClick={() => {
                  avroApi().getSettings().then((settings) => {
                    avroApi().formatReceipt({
                      settings,
                      sale: {
                        id: lastSale.id,
                        subtotal: lastSale.subtotal,
                        discount: lastSale.discount,
                        tax: lastSale.tax,
                        totalAmount: lastSale.totalAmount,
                        createdAt: lastSale.createdAt,
                        items: lastSale.items.map((i) => ({
                          quantity: i.quantity,
                          unitPrice: i.unitPrice,
                          lineTotal: i.lineTotal,
                          product: { name: i.product.name, sku: i.product.sku }
                        }))
                      }
                    }).then((receiptText: string) => {
                      const w = window.open("", "_blank");
                      if (w) {
                        w.document.write(`<pre style="font-family:monospace;font-size:12px;width:58mm;margin:0 auto">${receiptText}</pre><script>window.print();<\/script>`);
                        w.document.close();
                      }
                    });
                  });
                }}>
                  Print POS
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
