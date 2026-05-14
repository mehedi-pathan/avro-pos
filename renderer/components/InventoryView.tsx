"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { bdMoney } from "@/lib/bdFormat";
import { useAuth } from "@/hooks/useAuth";
import { avroApi } from "@/lib/api";
import type { Category, Product } from "@/lib/types";
import { ProductForm, emptyForm, type ProductFormState } from "@/components/ProductForm";

function downloadSampleCsv() {
  const headers = "sku,name,price,stockLevel,lowStockAt,category";
  const sample = "PROD-001,Sample Product A,29.99,50,5,General";
  const blob = new Blob([headers + "\n" + sample], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "avro-pos-sample-products.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row.");
  const headers = lines[0].split(",").map(h => h.trim());
  const skuIdx = headers.indexOf("sku");
  const nameIdx = headers.indexOf("name");
  const priceIdx = headers.indexOf("price");
  const stockIdx = headers.indexOf("stockLevel");
  const lowStockIdx = headers.indexOf("lowStockAt");
  const catIdx = headers.indexOf("category");
  if (skuIdx === -1 || nameIdx === -1 || priceIdx === -1) throw new Error("CSV must have sku, name, and price columns.");
  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.trim());
    return {
      sku: cols[skuIdx], name: cols[nameIdx],
      price: parseFloat(cols[priceIdx]),
      stockLevel: stockIdx >= 0 ? parseInt(cols[stockIdx]) || 0 : 0,
      lowStockAt: lowStockIdx >= 0 ? parseInt(cols[lowStockIdx]) || 5 : 5,
      category: catIdx >= 0 ? cols[catIdx] : undefined
    };
  });
}

function stockColor(level: number, lowAt: number): string {
  if (level <= 0) return "text-red-400";
  if (level <= lowAt) return "text-red-400";
  if (level <= lowAt * 2) return "text-amber-400";
  return "text-emerald-400";
}

function stockBg(level: number, lowAt: number): string {
  if (level <= 0) return "bg-red-400/10";
  if (level <= lowAt) return "bg-red-400/10";
  if (level <= lowAt * 2) return "bg-amber-400/10";
  return "bg-emerald-400/10";
}

export function InventoryView() {
  const { user, hasCapability } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [message, setMessage] = useState("");
  const [barcodeSvg, setBarcodeSvg] = useState("");
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [catForm, setCatForm] = useState("");
  const [subcatForm, setSubcatForm] = useState({ name: "", categoryId: "" });
  const [confirmDelete, setConfirmDelete] = useState<{
    type: "category" | "subcategory";
    id: string;
    name: string;
    subcategories?: { name: string; productCount: number; totalStock: number }[];
    totalProducts: number;
    totalStock: number;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  async function loadAll() {
    const [data, cats] = await Promise.all([
      avroApi().getProducts(), avroApi().listCategories()
    ]);
    setProducts(data);
    setCategories(cats);
  }

  useEffect(() => {
    if (hasCapability("INVENTORY_READ")) {
      loadAll().catch((error) => setMessage(error.message));
    }
  }, [hasCapability]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = products;
    if (q) {
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q)
      );
    }
    if (lowStockOnly) {
      list = list.filter((p) => p.stockLevel <= p.lowStockAt);
    }
    return list;
  }, [products, searchQuery, lowStockOnly]);

  const subcategories = categories.find(c => c.id === subcatForm.categoryId)?.subcategories ?? [];

  async function handleSaveProduct(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setBarcodeSvg("");
    try {
      const saved = await avroApi().upsertProduct({
        actorId: user?.id, id: form.id, sku: form.sku, name: form.name,
        price: Number(form.price), purchasePrice: Number(form.purchasePrice || 0),
        stockLevel: Number(form.stockLevel), lowStockAt: Number(form.lowStockAt),
        category: form.subcategoryId ? undefined : (form.category || null),
        subcategoryId: form.subcategoryId || null,
        imagePath: form.imagePath || null,
        vatType: form.vatType, vatRate: Number(form.vatRate || 0),
        brand: form.brand || null,
      });
      setForm(emptyForm);
      setShowForm(false);
      await loadAll();
      setMessage("Product saved.");
      try {
        const barcode = await avroApi().generateBarcode(saved.id);
        setBarcodeSvg(barcode.barcodeSvg);
      } catch { }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save product.");
    }
  }

  async function editProduct(product: Product) {
    setForm({
      id: product.id, sku: product.sku, name: product.name,
      price: String(product.price), purchasePrice: String(product.purchasePrice ?? ""),
      stockLevel: String(product.stockLevel), lowStockAt: String(product.lowStockAt),
      category: product.category ?? "", subcategoryId: product.subcategoryId ?? "",
      imagePath: product.imagePath ?? "", vatType: product.vatType || "EXCLUSIVE",
      vatRate: String(product.vatRate ?? 0), brand: product.brand ?? "",
    });
    setBarcodeSvg(product.barcodeSvg ?? "");
    setShowForm(true);
  }

  async function removeProduct(id: string) {
    setMessage("");
    try {
      await avroApi().deleteProduct(id);
      await loadAll();
      setMessage("Product deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete product.");
    }
  }

  async function printBarcode(product: Product) {
    try {
      const settings = await avroApi().getSettings();
      const html = await avroApi().formatBarcodeLabel({
        name: product.name, sku: product.sku, price: product.price,
        barcodeSvg: product.barcodeSvg, currencySymbol: settings.currencySymbol,
      });
      const w = window.open("", "_blank");
      if (w) { w.document.write(html); w.document.close(); }
    } catch { }
  }

  async function handleCsvUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsvImporting(true);
    setCsvResult("");
    try {
      const text = await file.text();
      const result = await avroApi().bulkCreateProducts(parseCsv(text));
      setCsvResult(`Created ${result.created} product(s), skipped ${result.skipped} duplicate(s).`);
      await loadAll();
    } catch (error) {
      setCsvResult(error instanceof Error ? error.message : "CSV import failed.");
    } finally {
      setCsvImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveCategory() {
    if (!catForm.trim()) return;
    setMessage("");
    try {
      await avroApi().upsertCategory({ name: catForm.trim() });
      setCatForm("");
      await loadAll();
      setMessage("Category added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add category.");
    }
  }

  async function removeCategory(id: string) {
    setMessage("");
    try {
      await avroApi().deleteCategory(id);
      await loadAll();
      setMessage("Category deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete category.");
    }
  }

  async function confirmDeleteCategory(id: string, name: string) {
    setConfirmLoading(true);
    try {
      const info = await avroApi().getCategoryDeleteInfo(id);
      setConfirmDelete({ type: "category", id, name, subcategories: info.subcategories, totalProducts: info.totalProducts, totalStock: info.totalStock });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load category info.");
    } finally {
      setConfirmLoading(false);
    }
  }

  async function executeDelete() {
    if (!confirmDelete) return;
    setConfirmLoading(true);
    try {
      if (confirmDelete.type === "category") await avroApi().deleteCategory(confirmDelete.id);
      else await avroApi().deleteSubcategory(confirmDelete.id);
      setConfirmDelete(null);
      await loadAll();
      setMessage(`${confirmDelete.type === "category" ? "Category" : "Subcategory"} deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete.");
      setConfirmDelete(null);
    } finally {
      setConfirmLoading(false);
    }
  }

  async function saveSubcategory() {
    if (!subcatForm.name.trim() || !subcatForm.categoryId) return;
    setMessage("");
    try {
      await avroApi().upsertSubcategory({ name: subcatForm.name.trim(), categoryId: subcatForm.categoryId });
      setSubcatForm({ name: "", categoryId: "" });
      await loadAll();
      setMessage("Subcategory added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add subcategory.");
    }
  }

  function confirmDeleteSubcategory(id: string, name: string, productCount: number, stockCount: number) {
    setConfirmDelete({ type: "subcategory", id, name, totalProducts: productCount, totalStock: stockCount });
  }

  function closeForm() {
    setShowForm(false);
    setForm(emptyForm);
    setBarcodeSvg("");
  }

  if (!hasCapability("INVENTORY_READ")) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8 text-sm text-[var(--text-mid)] backdrop-blur-xl">
          Manager or Owner access required.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-hidden">
      {message ? (
        <p className="rounded border border-[var(--border-default)] bg-[var(--bg-overlay)] px-4 py-2.5 text-sm text-[var(--text-message)]">
          {message}
        </p>
      ) : null}

      <div className="flex gap-4 shrink-0 flex-wrap items-center">
        <div className="flex-1 min-w-[280px] relative">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-[var(--text-muted)] transition-all focus:border-teal/50 focus:outline-none focus:ring-2 focus:ring-teal/10"
            placeholder="Search by Name, SKU, or Category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="rounded border-[var(--border-default)] text-teal focus:ring-teal/30"
          />
          <span className="text-xs text-[var(--text-default)]">Low stock only</span>
        </label>
        {hasCapability("INVENTORY_WRITE") && (
          <button
            className="rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-ink hover:bg-teal/90 transition-all shadow-lg shadow-teal/20"
            onClick={() => { setForm(emptyForm); setBarcodeSvg(""); setShowForm(true); }}
          >
            + Add New Product
          </button>
        )}
        <label className="cursor-pointer rounded-lg border border-[var(--border-light)] px-4 py-2.5 text-sm text-[var(--text-default)] hover:bg-[var(--bg-card)] transition-all">
          {csvImporting ? "Importing..." : "Bulk Import (CSV)"}
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} disabled={csvImporting} />
        </label>
        <button className="rounded-lg border border-[var(--border-light)] px-4 py-2.5 text-xs text-[var(--text-mid)] hover:bg-[var(--bg-card)] transition-all" onClick={downloadSampleCsv}>
          Sample CSV
        </button>
      </div>

      <div className="flex flex-1 gap-5 overflow-hidden">
        <div className="flex w-[220px] shrink-0 flex-col gap-4 overflow-y-auto">
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 backdrop-blur-xl">
            <h2 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Categories</h2>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {categories.map(c => (
                <span key={c.id} className="inline-flex items-center gap-1 rounded bg-[var(--bg-input)] px-2 py-0.5 text-xs text-[var(--text-default)]">
                  {c.name}
                  {hasCapability("INVENTORY_WRITE") ? (
                    <button className="text-red-400 hover:text-red-300" onClick={() => confirmDeleteCategory(c.id, c.name)}>x</button>
                  ) : null}
                </span>
              ))}
              {categories.length === 0 && <p className="text-xs text-[var(--text-secondary)]">No categories yet.</p>}
            </div>
            {hasCapability("INVENTORY_WRITE") ? (
              <div className="flex gap-2">
                <input className="min-w-0 flex-1 rounded bg-[var(--bg-input)] px-2 py-1.5 text-xs text-ink" placeholder="New category" value={catForm} onChange={e => setCatForm(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), saveCategory())} />
                <button className="rounded bg-teal px-2 py-1.5 text-xs font-medium text-ink" onClick={saveCategory}>Add</button>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 backdrop-blur-xl">
            <h2 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Subcategories</h2>
            {hasCapability("INVENTORY_WRITE") ? (
              <div className="flex flex-col gap-2 mb-2">
                <select className="rounded bg-[var(--bg-input)] px-2 py-1.5 text-xs text-ink" value={subcatForm.categoryId} onChange={e => setSubcatForm({ ...subcatForm, categoryId: e.target.value })}>
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="flex gap-2">
                  <input className="min-w-0 flex-1 rounded bg-[var(--bg-input)] px-2 py-1.5 text-xs text-ink" placeholder="New subcategory" value={subcatForm.name} onChange={e => setSubcatForm({ ...subcatForm, name: e.target.value })} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), saveSubcategory())} />
                  <button className="rounded bg-teal px-2 py-1.5 text-xs font-medium text-ink" onClick={saveSubcategory}>Add</button>
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              {subcategories.map(s => {
                const cnt = (s as typeof s & { _count?: { products: number } })._count?.products ?? 0;
                return (
                  <span key={s.id} className="inline-flex items-center gap-1 rounded bg-[var(--bg-input)] px-2 py-0.5 text-xs text-[var(--text-default)]">
                    {s.name}
                    {cnt > 0 ? <span className="text-[var(--text-tertiary)]">({cnt})</span> : null}
                    {hasCapability("INVENTORY_WRITE") ? (
                      <button className="text-red-400 hover:text-red-300" onClick={() => confirmDeleteSubcategory(s.id, s.name, cnt, 0)}>x</button>
                    ) : null}
                  </span>
                );
              })}
              {subcatForm.categoryId && subcategories.length === 0 && <p className="text-xs text-[var(--text-secondary)]">No subcategories yet.</p>}
            </div>
          </div>

          {csvResult ? <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-400">{csvResult}</p> : null}
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-[var(--border-default)] px-5 py-3 shrink-0">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {filtered.length} product{filtered.length !== 1 ? "s" : ""}
              {lowStockOnly && <span className="ml-2 text-xs text-amber-400">(low stock only)</span>}
            </p>
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse text-left text-sm" style={{ tableLayout: "fixed" }}>
              <thead className="sticky top-0 z-10 bg-[var(--th-bg)] text-[var(--text-mid)] text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-3 w-[52px]" />
                  <th className="p-3 font-medium">Product</th>
                  <th className="p-3 font-medium w-[100px]">Brand</th>
                  <th className="p-3 font-medium w-[120px]">Category</th>
                  <th className="p-3 font-medium w-[100px] text-right">Price</th>
                  <th className="p-3 font-medium w-[80px] text-right">Stock</th>
                  <th className="p-3 font-medium w-[140px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr className="border-t border-[var(--border-default)] hover:bg-[var(--bg-card-hover)] transition-colors" key={product.id}>
                    <td className="p-2 pl-3">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-input-ghost)]">
                        {product.imagePath ? (
                          <img src={product.imagePath} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-[var(--text-muted)]">
                            {product.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <p className="font-medium text-[var(--text-primary)] truncate">{product.name}</p>
                      <p className="text-[11px] text-[var(--text-tertiary)] font-mono">{product.sku}</p>
                    </td>
                    <td className="p-3">
                      <span className="text-xs text-[var(--text-default)]">{product.brand || "—"}</span>
                    </td>
                    <td className="p-3">
                      <span className="inline-block rounded-full bg-teal/10 px-2.5 py-0.5 text-[11px] font-medium text-teal truncate max-w-full">
                        {product.subcategory
                          ? `${product.subcategory.category.name} › ${product.subcategory.name}`
                          : (product.category ?? "—")}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold tabular-nums text-[var(--text-primary)]">
                      {bdMoney(product.price)}
                    </td>
                    <td className="p-3 text-right">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${stockColor(product.stockLevel, product.lowStockAt)} ${stockBg(product.stockLevel, product.lowStockAt)}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${stockColor(product.stockLevel, product.lowStockAt)}`} />
                        {product.stockLevel}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        {hasCapability("INVENTORY_WRITE") && (
                          <button
                            className="rounded p-1.5 text-[var(--text-muted)] hover:text-teal hover:bg-teal/10 transition-all"
                            title="Edit product"
                            onClick={() => editProduct(product)}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        <button
                          className="rounded p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-all"
                          title="Print barcode label"
                          onClick={() => printBarcode(product)}
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                        </button>
                        {hasCapability("DELETE_RECORDS") && (
                          <button
                            className="rounded p-1.5 text-[var(--text-muted)] hover:text-red-400 hover:bg-red-400/10 transition-all"
                            title="Delete product"
                            onClick={() => removeProduct(product.id)}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="flex items-center justify-center py-20 text-sm text-[var(--text-muted)]">
                {searchQuery || lowStockOnly ? "No products match your filters." : "No products yet. Click \"Add New Product\" to get started."}
              </div>
            )}
          </div>
        </div>
      </div>

      <ProductForm
        open={showForm}
        onClose={closeForm}
        form={form}
        setForm={setForm}
        categories={categories}
        onSave={handleSaveProduct}
        message={message}
        barcodeSvg={barcodeSvg}
      />

      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => !confirmLoading && setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 shadow-2xl backdrop-blur-xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold text-[var(--text-high)]">Delete {confirmDelete.type === "category" ? "Category" : "Subcategory"}</h3>
              <p className="mt-1.5 text-sm text-[var(--text-mid)]">
                Are you sure you want to delete <span className="font-medium text-[var(--text-high)]">{confirmDelete.name}</span>?
              </p>

              {confirmDelete.type === "category" && confirmDelete.subcategories && confirmDelete.subcategories.length > 0 ? (
                <div className="mt-4 space-y-1.5">
                  <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Subcategories</p>
                  {confirmDelete.subcategories.map(s => (
                    <div key={s.name} className="flex items-center justify-between rounded bg-[var(--bg-overlay)] px-3 py-1.5 text-sm">
                      <span className="text-[var(--text-high)]">{s.name}</span>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {s.productCount > 0 ? `${s.productCount} product(s), ${s.totalStock} in stock` : "No products"}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between rounded bg-teal/10 px-3 py-1.5 text-sm font-medium">
                    <span className="text-[var(--text-high)]">Total</span>
                    <span className="text-teal">{confirmDelete.totalProducts} product(s), {confirmDelete.totalStock} in stock</span>
                  </div>
                </div>
              ) : confirmDelete.type === "category" ? (
                <p className="mt-3 text-xs text-[var(--text-tertiary)]">This category has no subcategories.</p>
              ) : (
                <p className="mt-3 text-xs text-[var(--text-secondary)]">
                  {confirmDelete.totalProducts > 0
                    ? `${confirmDelete.totalProducts} product(s) assigned — they will lose this subcategory association.`
                    : "No products are assigned to this subcategory."}
                </p>
              )}

              <div className="mt-5 flex justify-end gap-2">
                <button className="rounded border border-[var(--border-light)] px-4 py-2 text-sm text-[var(--text-high)] hover:bg-[var(--bg-card)]" onClick={() => setConfirmDelete(null)} disabled={confirmLoading}>
                  Cancel
                </button>
                <button className="rounded bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50" onClick={executeDelete} disabled={confirmLoading}>
                  {confirmLoading ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
