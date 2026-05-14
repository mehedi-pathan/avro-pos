"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bdMoney, bdDateTime } from "@/lib/bdFormat";
import { useAuth } from "@/hooks/useAuth";
import { avroApi } from "@/lib/api";
import type { BusinessSettings, Customer, Product, Sale } from "@/lib/types";
import { useCart } from "@/store/useCart";

type PaymentMethod = "cash" | "card" | "bkash" | "nagad" | "rocket" | "upay";

const paymentMethods: { key: PaymentMethod; label: string; icon: string }[] = [
  { key: "cash", label: "Cash", icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v2h-2zm0 4h2v6h-2z" },
  { key: "card", label: "Card", icon: "M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4V6h16v12zm-2-4H6v-2h12v2zm0-4H6V8h12v2z" },
  { key: "bkash", label: "bKash", icon: "M17 1H7c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 17H7V6h10v12z" },
  { key: "nagad", label: "Nagad", icon: "M17 1H7c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 17H7V6h10v12z" },
  { key: "rocket", label: "Rocket", icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" },
  { key: "upay", label: "uPay", icon: "M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" },
];

const digitalMethods: PaymentMethod[] = ["bkash", "nagad", "rocket", "upay"];

export function CheckoutView() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [sku, setSku] = useState("");
  const [message, setMessage] = useState("");
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmPaid, setConfirmPaid] = useState(false);
  const cart = useCart();
  const searchRef = useRef<HTMLInputElement>(null);
  const [clock, setClock] = useState("");

  const isDigital = digitalMethods.includes(paymentMethod);
  const isCard = paymentMethod === "card";
  const effectiveReceived = isDigital ? cart.total() : isCard ? cart.total() : receivedAmount;
  const change = Math.max(0, effectiveReceived - cart.total());

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("en-BD", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }));
    };
    tick();
    const ti = setInterval(tick, 1000);
    return () => clearInterval(ti);
  }, []);

  async function loadData() {
    const [nextProducts, nextCustomers, settings] = await Promise.all([
      avroApi().getProducts(),
      avroApi().listCustomers(),
      avroApi().getSettings(),
    ]);
    setProducts(nextProducts);
    setCustomers(nextCustomers);
    const rate = parseFloat((settings as unknown as BusinessSettings).taxRate ?? "5");
    if (!isNaN(rate) && rate > 0) cart.setTaxRate(rate);
  }

  useEffect(() => {
    loadData().catch((err) => setMessage(err.message));
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((p) =>
      [p.sku, p.name, p.category ?? ""].some((v) => v.toLowerCase().includes(needle))
    );
  }, [products, query]);

  function handleAddSku(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    const found = cart.addBySku(sku, products);
    setSku("");
    if (!found) setMessage("No product found for that SKU.");
  }

  function handlePaymentClick(pm: PaymentMethod) {
    setPaymentMethod(pm);
    if (digitalMethods.includes(pm)) {
      setConfirmPaid(false);
      setShowConfirm(true);
    }
  }

  function handleConfirmPaid() {
    setConfirmPaid(true);
    setShowConfirm(false);
  }

  async function completeSale() {
    setMessage("");
    setProcessing(true);
    try {
      const result = (await avroApi().processSale({
        userId: user?.id,
        actorId: user?.id,
        customerId: cart.customer?.id,
        taxRate: cart.taxRate / 100,
        discount: cart.discount,
        paymentMethod,
        items: cart.lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      })) as { id: string };
      cart.clear();
      setConfirmPaid(false);
      await loadData();
      const fullSale = await avroApi().getSale(result.id);
      setLastSale(fullSale);
      setReceivedAmount(0);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Sale failed.");
    } finally {
      setProcessing(false);
    }
  }

  const canComplete =
    cart.lines.length > 0 &&
    !processing &&
    (!isDigital || confirmPaid) &&
    (!isCard || receivedAmount > 0 || true) &&
    (!isDigital || true);

  return (
    <div className="flex h-full w-full gap-4 overflow-hidden">
      <div className="flex flex-1 flex-col gap-4 overflow-hidden min-w-0">
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-[var(--text-muted)] transition-all focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-teal/10"
              placeholder="Search products... (Ctrl+K)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-mid)] whitespace-nowrap">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-mono tabular-nums">{clock} BST</span>
          </div>
          <form className="flex gap-2 shrink-0" onSubmit={handleAddSku}>
            <input
              className="w-32 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-ink placeholder:text-[var(--text-muted)]"
              placeholder="Scan SKU"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
            />
            <button type="submit" className="rounded-lg bg-teal px-4 py-2.5 text-sm font-medium text-ink transition-all hover:bg-teal/80">
              Add
            </button>
          </form>
        </div>

        <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            <div className="flex-1 overflow-y-auto">
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
                <AnimatePresence>
                  {filtered.map((product) => (
                    <motion.button
                      key={product.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="group flex flex-col rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] text-left shadow-sm backdrop-blur-xl transition-all hover:border-teal/30 hover:bg-[var(--bg-card-hover)] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40 overflow-hidden"
                      disabled={product.stockLevel <= 0}
                      onClick={() => cart.addProduct(product)}
                    >
                      <div className="aspect-[4/3] w-full bg-[var(--bg-input-ghost)] flex items-center justify-center overflow-hidden">
                        <img
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(product.name)}&background=247b7b&color=fff&size=128&bold=true&format=svg`}
                          alt={product.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="flex flex-col gap-1 p-3">
                        <p className="text-sm font-semibold leading-snug text-[var(--text-primary)] transition-colors group-hover:text-teal truncate">{product.name}</p>
                        <p className="text-[11px] text-[var(--text-tertiary)] truncate">{product.sku}</p>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="rounded bg-teal/15 px-2 py-0.5 text-xs font-bold text-teal">{bdMoney(product.price)}</span>
                          <span className={`text-xs font-medium tabular-nums ${product.stockLevel <= product.lowStockAt ? "text-amber-400" : "text-emerald-300"}`}>{product.stockLevel}</span>
                        </div>
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

          <div className="flex w-[45%] shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--glass-shadow)] backdrop-blur-xl min-h-0">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3 shrink-0">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Cart ({cart.lines.length})</h2>
              <button
                className="rounded border border-[var(--border-light)] px-3 py-1 text-xs text-[var(--text-mid)] hover:text-teal hover:border-teal/30 transition-all"
                onClick={() => {
                  if (!customers.length) {
                    setMessage("No customers available. Create one in Customers.");
                    return;
                  }
                  const name = prompt("Customer name:");
                  if (!name) return;
                  avroApi().upsertCustomer({ name, phone: `walkin-${Date.now()}` }).then((c) => {
                    cart.setCustomer(c);
                    setCustomers(prev => [...prev, c]);
                  }).catch((err) => setMessage(err.message));
                }}
              >
                + Add Customer
              </button>
            </div>

            <div className="flex items-center gap-2 border-b border-[var(--border-default)] px-4 py-2.5 shrink-0">
              <select
                className="flex-1 rounded bg-[var(--bg-input)] px-3 py-1.5 text-sm text-ink"
                value={cart.customer?.id ?? ""}
                onChange={(e) => cart.setCustomer(customers.find((c) => c.id === e.target.value) ?? null)}
              >
                <option value="">Walk-in customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.points} pts)</option>
                ))}
              </select>
              {cart.parkedCarts.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {cart.parkedCarts.map((p) => (
                    <button
                      key={p.id}
                      className="rounded border border-[var(--border-light)] px-2 py-0.5 text-[10px] text-[var(--text-mid)] hover:text-teal transition-all"
                      onClick={() => cart.restoreCart(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-y-auto flex-1 min-h-0">
              {cart.lines.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[var(--bg-card)] z-10">
                    <tr className="text-xs text-[var(--text-mid)]">
                      <th className="p-3 pl-4 text-left font-medium">Item</th>
                      <th className="p-3 text-right font-medium">Price</th>
                      <th className="p-3 text-center font-medium">Qty</th>
                      <th className="p-3 pr-4 text-right font-medium">Total</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {cart.lines.map((line) => (
                      <tr key={line.product.id} className="border-t border-[var(--border-default)] group/item">
                        <td className="p-3 pl-4 text-[var(--text-primary)] truncate max-w-[160px]">{line.product.name}</td>
                        <td className="p-3 text-right text-[var(--text-high)] whitespace-nowrap">{bdMoney(line.product.price)}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
                            <button className="flex h-6 w-6 items-center justify-center rounded border border-[var(--border-light)] text-xs text-[var(--text-mid)] hover:text-[var(--text-primary)] transition-all"
                              onClick={() => cart.setQuantity(line.product.id, line.quantity - 1)}>-</button>
                            <span className="w-8 text-center tabular-nums text-[var(--text-primary)]">{line.quantity}</span>
                            <button className="flex h-6 w-6 items-center justify-center rounded border border-[var(--border-light)] text-xs text-[var(--text-mid)] hover:text-[var(--text-primary)] transition-all"
                              onClick={() => cart.setQuantity(line.product.id, line.quantity + 1)}>+</button>
                          </div>
                        </td>
                        <td className="p-3 pr-4 text-right font-medium text-[var(--text-primary)] whitespace-nowrap">{bdMoney(line.product.price * line.quantity)}</td>
                        <td className="p-1 pr-3">
                          <button className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] opacity-0 group-hover/item:opacity-100 hover:text-red-400 transition-all"
                            onClick={() => cart.removeProduct(line.product.id)}>
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center justify-center py-16">
                  <p className="text-sm text-[var(--text-muted)]">Cart is empty</p>
                </div>
              )}
            </div>
            {cart.lines.length > 0 && (
              <div className="flex items-center gap-2 border-t border-[var(--border-default)] px-4 py-3 shrink-0">
                <button
                  className="flex-1 rounded-lg border border-[var(--border-light)] px-3 py-2 text-xs font-medium text-[var(--text-mid)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-all"
                  onClick={() => {
                    const name = prompt("Save cart as:");
                    if (name) cart.parkCart(name);
                  }}
                >
                  Save Cart
                </button>
                <button
                  className="flex-1 rounded-lg border border-red-400/20 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-400/10 transition-all"
                  onClick={() => cart.clear()}
                >
                  Clear Cart
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex w-[320px] shrink-0 flex-col gap-4 overflow-y-auto min-h-0">
        <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 shadow-[var(--glass-shadow)] backdrop-blur-xl shrink-0">
          <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Order Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-[var(--text-default)]">
              <span>Subtotal</span>
              <span>{bdMoney(cart.subtotal())}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[var(--text-default)]">Discount</span>
              <input
                className="w-20 rounded bg-[var(--bg-input)] px-2 py-1 text-right text-sm text-ink"
                type="number" min={0} step="0.01" value={cart.discount}
                onChange={(e) => cart.setDiscount(Number(e.target.value))}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[var(--text-default)]">VAT ({cart.taxRate}%)</span>
              <span>{bdMoney(cart.tax())}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--border-default)] pt-2 text-lg font-bold text-[var(--text-primary)]">
              <span>Due</span>
              <span>{bdMoney(cart.total())}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 shadow-[var(--glass-shadow)] backdrop-blur-xl shrink-0">
          <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Payment Method</h3>
          <div className="grid grid-cols-3 gap-2">
            {paymentMethods.map((pm) => (
              <button
                key={pm.key}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-[10px] transition-all ${
                  paymentMethod === pm.key && (!digitalMethods.includes(pm.key) || confirmPaid)
                    ? "border-teal/50 bg-teal/10 text-teal"
                    : "border-[var(--border-default)] text-[var(--text-mid)] hover:border-[var(--border-light)] hover:bg-[var(--bg-card)]"
                }`}
                onClick={() => handlePaymentClick(pm.key)}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={pm.icon} />
                </svg>
                {pm.label}
                {digitalMethods.includes(pm.key) && confirmPaid && paymentMethod === pm.key && (
                  <span className="text-[8px] text-emerald-400">Confirmed</span>
                )}
              </button>
            ))}
          </div>

          {paymentMethod === "cash" && cart.lines.length > 0 && (
            <div className="mt-3 space-y-2 border-t border-[var(--border-default)] pt-3">
              <label className="text-xs text-[var(--text-secondary)]">Quick Cash</label>
              <div className="flex gap-1.5 flex-wrap">
                {[500, 1000, 2000, 5000].map((amt) => (
                  <button
                    key={amt}
                    className={`rounded border px-2.5 py-1 text-xs transition-all ${
                      receivedAmount === amt
                        ? "border-teal/50 bg-teal/10 text-teal"
                        : "border-[var(--border-default)] text-[var(--text-mid)] hover:bg-[var(--bg-card)]"
                    }`}
                    onClick={() => setReceivedAmount(amt)}
                  >
                    {bdMoney(amt)}
                  </button>
                ))}
                <button
                  className={`rounded border px-2.5 py-1 text-xs transition-all ${
                    receivedAmount > 0 && ![500, 1000, 2000, 5000].includes(receivedAmount)
                      ? "border-teal/50 bg-teal/10 text-teal"
                      : "border-[var(--border-default)] text-[var(--text-mid)] hover:bg-[var(--bg-card)]"
                  }`}
                  onClick={() => {
                    const amt = prompt("Custom amount (৳):");
                    if (amt) setReceivedAmount(Number(amt));
                  }}
                >
                  Custom
                </button>
              </div>
              <input
                className="w-full rounded bg-[var(--bg-input)] px-3 py-1.5 text-sm text-ink"
                type="number" min={0} step="0.01" placeholder="Enter received amount"
                value={receivedAmount || ""}
                onChange={(e) => setReceivedAmount(Number(e.target.value))}
              />
              {receivedAmount >= cart.total() && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-default)]">Change</span>
                  <span className="font-semibold text-emerald-400">{bdMoney(change)}</span>
                </div>
              )}
            </div>
          )}

          {(isCard || isDigital) && cart.lines.length > 0 && (
            <div className="mt-3 space-y-2 border-t border-[var(--border-default)] pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-default)]">Total Due</span>
                <span className="font-bold text-[var(--text-primary)]">{bdMoney(cart.total())}</span>
              </div>
              {(isDigital && confirmPaid) && (
                <p className="text-xs text-emerald-400">Payment confirmed via {paymentMethod === "bkash" ? "bKash" : paymentMethod === "nagad" ? "Nagad" : paymentMethod === "rocket" ? "Rocket" : "uPay"}</p>
              )}
            </div>
          )}
        </div>

        <AnimatePresence>
          {message && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400 shrink-0"
            >
              {message}
            </motion.p>
          )}
        </AnimatePresence>

        <button
          className="w-full rounded-xl bg-teal px-4 py-3.5 text-sm font-semibold text-ink shadow-lg shadow-teal/20 transition-all hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-40 shrink-0"
          disabled={!canComplete}
          onClick={completeSale}
        >
          {processing ? "Processing..." : `Complete Sale — ${bdMoney(cart.total())}`}
        </button>

        <div className="flex-1 min-h-0" />
      </div>

      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="mx-4 w-full max-w-sm rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-2xl backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                Confirm {paymentMethod === "bkash" ? "bKash" : paymentMethod === "nagad" ? "Nagad" : paymentMethod === "rocket" ? "Rocket" : "uPay"} Payment
              </h3>
              <p className="text-sm text-[var(--text-default)] mb-4">
                Has the customer completed the {paymentMethod === "bkash" ? "bKash" : paymentMethod === "nagad" ? "Nagad" : paymentMethod === "rocket" ? "Rocket" : "uPay"} transfer for <strong>{bdMoney(cart.total())}</strong>?
              </p>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                Verify the TrxID in your {paymentMethod === "bkash" ? "bKash" : paymentMethod === "nagad" ? "Nagad" : paymentMethod === "rocket" ? "Rocket" : "uPay"} app before confirming.
              </p>
              <div className="flex gap-3">
                <button
                  className="flex-1 rounded-lg border border-[var(--border-light)] px-4 py-2.5 text-sm text-[var(--text-default)] hover:bg-[var(--bg-card-hover)] transition-all"
                  onClick={() => { setShowConfirm(false); setPaymentMethod("cash"); }}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 rounded-lg bg-teal px-4 py-2.5 text-sm font-medium text-ink hover:bg-teal/90 transition-all"
                  onClick={handleConfirmPaid}
                >
                  Yes, Payment Received
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-emerald-400">Payment Successful</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">Invoice #{lastSale.receiptNumber ?? lastSale.id.slice(0, 12)}</p>
                </div>
                <button className="rounded border border-[var(--border-light)] px-3 py-1.5 text-sm text-[var(--text-default)] hover:bg-[var(--bg-card-hover)] transition-all" onClick={() => setLastSale(null)}>
                  Close
                </button>
              </div>

              <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">Salesperson</p>
                  <p className="font-medium text-[var(--text-primary)]">{lastSale.user?.displayName ?? "N/A"}</p>
                  <p className="text-xs text-[var(--text-muted)]">ID: {lastSale.user?.staffId ?? "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">Date & Time</p>
                  <p className="font-medium text-[var(--text-primary)]">{bdDateTime(lastSale.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">Customer</p>
                  <p className="font-medium text-[var(--text-primary)]">{lastSale.customer?.name ?? "Walk-in"}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">Payment</p>
                  <p className="font-medium text-[var(--text-primary)] capitalize">{lastSale.paymentMethod ?? "Cash"}</p>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--border-default)]">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-[var(--bg-card)] text-xs text-[var(--text-mid)]">
                    <tr>
                      <th className="p-2.5 pl-3 font-medium">Item</th>
                      <th className="p-2.5 text-center font-medium">Qty</th>
                      <th className="p-2.5 pr-3 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastSale.items.map((item) => (
                      <tr key={item.id} className="border-t border-[var(--border-default)]">
                        <td className="p-2.5 pl-3 text-[var(--text-primary)]">{item.product.name}</td>
                        <td className="p-2.5 text-center text-[var(--text-high)]">{item.quantity}&times;{bdMoney(item.unitPrice)}</td>
                        <td className="p-2.5 pr-3 text-right font-medium text-[var(--text-primary)]">{bdMoney(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="ml-auto mt-4 w-full space-y-1.5 text-sm border-t border-[var(--border-default)] pt-3">
                <div className="flex justify-between text-[var(--text-default)]">
                  <span>Subtotal</span>
                  <span>{bdMoney(lastSale.subtotal)}</span>
                </div>
                {lastSale.discount > 0 && (
                  <div className="flex justify-between text-[var(--text-default)]">
                    <span>Discount</span>
                    <span className="text-red-400">-{bdMoney(lastSale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[var(--text-default)]">
                  <span>VAT</span>
                  <span>{bdMoney(lastSale.tax)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-[var(--text-primary)] pt-1 border-t border-[var(--border-default)]">
                  <span>Total</span>
                  <span>{bdMoney(lastSale.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-sm text-[var(--text-default)]">
                  <span>Received</span>
                  <span className="text-emerald-400">{bdMoney(lastSale.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-sm text-[var(--text-default)]">
                  <span>Change</span>
                  <span>{bdMoney(0)}</span>
                </div>
              </div>

              <div className="mt-5 flex justify-center gap-3">
                <button
                  className="flex-1 rounded-lg bg-teal px-4 py-2.5 text-sm font-medium text-ink hover:bg-teal/90 transition-all"
                  onClick={() => {
                    avroApi().getSettings().then((settings) => {
                      const currencySymbol = settings.currencySymbol;
                      const fmt = (n: number) => `${currencySymbol}${n.toFixed(2)}`;
                      const itemsHtml = lastSale.items.map((item) =>
                        `<tr><td style="padding:4px">${item.product.name}</td><td style="padding:4px;text-align:center">${item.quantity}</td><td style="padding:4px;text-align:right">${fmt(item.unitPrice)}</td><td style="padding:4px;text-align:right">${fmt(item.lineTotal)}</td></tr>`
                      ).join("");
                      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice</title><style>
                        @page{size:A4;margin:15mm} body{font-family:'Segoe UI',Arial,sans-serif;color:#17202a;padding:20px}
                        .header{text-align:center;border-bottom:2px solid #247b7b;padding-bottom:14px;margin-bottom:16px}
                        .header h1{margin:0;font-size:22px;color:#247b7b}
                        .meta{display:flex;justify-content:space-between;margin-bottom:14px;font-size:12px;color:#444}
                        table{width:100%;border-collapse:collapse;margin-bottom:14px}
                        th{background:#247b7b;color:#fff;padding:6px;text-align:left;font-size:12px} th:last-child{text-align:right}
                        td{border-bottom:1px solid #ddd;padding:6px;font-size:12px}
                        .totals{width:280px;margin-left:auto} .totals td{border:none;padding:3px 8px}
                        .totals .final td{font-size:16px;font-weight:700;border-top:2px solid #247b7b;padding-top:6px}
                        .footer{text-align:center;margin-top:20px;padding-top:10px;border-top:1px solid #ddd;font-size:10px;color:#999}
                      </style></head><body>
                        <div class="header"><h1>${settings.businessName}</h1><p>${settings.address}${settings.taxId ? ` | Tax: ${settings.taxId}` : ""}</p></div>
                        <div class="meta"><div><strong>Invoice:</strong> ${lastSale.receiptNumber ?? lastSale.id}<br><strong>Date:</strong> ${bdDateTime(lastSale.createdAt)}</div>
                        <div style="text-align:right"><strong>Salesperson:</strong> ${lastSale.user?.displayName ?? "N/A"} (${lastSale.user?.staffId ?? ""})<br><strong>Payment:</strong> ${lastSale.paymentMethod ?? "Cash"}</div></div>
                        ${lastSale.customer ? `<p style="font-size:12px;margin-bottom:8px"><strong>Customer:</strong> ${lastSale.customer.name}</p>` : ""}
                        <table><thead><tr><th>Item</th><th style="width:50px;text-align:center">Qty</th><th style="width:80px;text-align:right">Price</th><th style="width:80px;text-align:right">Total</th></tr></thead><tbody>${itemsHtml}</tbody></table>
                        <table class="totals"><tr><td>Subtotal</td><td style="text-align:right">${fmt(lastSale.subtotal)}</td></tr>
                        ${lastSale.discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">-${fmt(lastSale.discount)}</td></tr>` : ""}
                        <tr><td>VAT</td><td style="text-align:right">${fmt(lastSale.tax)}</td></tr>
                        <tr class="final"><td>Total</td><td style="text-align:right">${fmt(lastSale.totalAmount)}</td></tr></table>
                        <div class="footer">Thank you for your business!<br>Powered by Avro POS v2.0.3.12 &mdash; Developed by Mehedi Pathan</div>
                        <script>window.print();<\/script></body></html>`;
                      const w = window.open("", "_blank");
                      if (w) { w.document.write(html); w.document.close(); }
                    });
                  }}
                >
                  Print Invoice (A4)
                </button>
                <button
                  className="flex-1 rounded-lg border border-[var(--border-light)] px-4 py-2.5 text-sm text-[var(--text-high)] hover:bg-[var(--bg-card-hover)] transition-all"
                  onClick={() => {
                    avroApi().getSettings().then((settings) => {
                      avroApi().formatReceipt({
                        settings: { businessName: settings.businessName, address: settings.address, taxId: settings.taxId, currencySymbol: settings.currencySymbol },
                        sale: {
                          id: lastSale.id,
                          subtotal: lastSale.subtotal,
                          discount: lastSale.discount,
                          tax: lastSale.tax,
                          totalAmount: lastSale.totalAmount,
                          createdAt: lastSale.createdAt,
                          paymentMethod: lastSale.paymentMethod,
                          items: lastSale.items.map((i) => ({
                            quantity: i.quantity,
                            unitPrice: i.unitPrice,
                            lineTotal: i.lineTotal,
                            product: { name: i.product.name, sku: i.product.sku },
                          })),
                        },
                      }).then((receiptText: string) => {
                        const w = window.open("", "_blank");
                        if (w) {
                          const displayText = receiptText.replace(/[₹$]/g, "").replace(/\b(\d+\.\d{2})\b/g, (m) => `${settings.currencySymbol === "৳" ? "TK" : settings.currencySymbol}${m}`);
                          w.document.write(`<pre style="font-family:monospace;font-size:12px;width:58mm;margin:0 auto">${receiptText}</pre><script>window.print();<\/script>`);
                          w.document.close();
                        }
                      });
                    });
                  }}
                >
                  Print POS
                </button>
              </div>
              <button
                className="mt-3 w-full rounded-lg border border-teal/30 px-4 py-2.5 text-sm font-medium text-teal hover:bg-teal/10 transition-all"
                onClick={() => { setLastSale(null); cart.clear(); }}
              >
                New Sale
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
