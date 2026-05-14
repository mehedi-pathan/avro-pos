"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FormEvent, useEffect, useRef, useState } from "react";
import { bdMoney } from "@/lib/bdFormat";
import { avroApi } from "@/lib/api";
import type { Category, Product } from "@/lib/types";

export type ProductFormState = {
  id?: string;
  sku: string;
  name: string;
  price: string;
  purchasePrice: string;
  stockLevel: string;
  lowStockAt: string;
  category: string;
  subcategoryId: string;
  imagePath: string;
  vatType: "INCLUSIVE" | "EXCLUSIVE";
  vatRate: string;
  brand: string;
};

export const emptyForm: ProductFormState = {
  sku: "", name: "", price: "", purchasePrice: "", stockLevel: "", lowStockAt: "5",
  category: "", subcategoryId: "", imagePath: "", vatType: "EXCLUSIVE", vatRate: "0", brand: "",
};

export function ProductForm({
  open,
  onClose,
  form,
  setForm,
  categories,
  onSave,
  message,
  barcodeSvg,
}: {
  open: boolean;
  onClose: () => void;
  form: ProductFormState;
  setForm: (f: ProductFormState) => void;
  categories: Category[];
  onSave: (e: FormEvent) => Promise<void>;
  message: string;
  barcodeSvg: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(form.imagePath || "");

  useEffect(() => {
    setPreview(form.imagePath || "");
  }, [form.imagePath]);

  async function handleImagePick() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setPreview(dataUrl);
        setForm({ ...formRef.current, imagePath: dataUrl });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  const formRef = useRef(form);
  formRef.current = form;

  function autoGenerateSku() {
    const prefix = (form.name || "PROD").slice(0, 4).toUpperCase();
    const timestamp = Date.now().toString(36).toUpperCase();
    setForm({ ...form, sku: `${prefix}-${timestamp}` });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(e);
    } finally {
      setSaving(false);
    }
  }

  const subcategories = categories.find((c) => c.id === form.subcategoryId?.split("|")[0])
    ?.subcategories ?? [];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-lg border-l border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-default)] px-5 py-4 shrink-0">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                {form.id ? "Edit Product" : "Add New Product"}
              </h2>
              <button
                className="rounded p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-all"
                onClick={onClose}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
              {message && (
                <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                  {message}
                </p>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Product Image</label>
                <div
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--border-default)] bg-[var(--bg-input-ghost)] p-4 transition-all hover:border-teal/40 hover:bg-teal/5"
                  onClick={handleImagePick}
                >
                  {preview ? (
                    <img src={preview} alt="Preview" className="h-24 w-24 rounded-lg object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <svg className="h-8 w-8 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-xs text-[var(--text-muted)]">Click to upload image</p>
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Product Name *</label>
                  <input
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-ink placeholder:text-[var(--text-muted)]"
                    placeholder="Enter product name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">SKU *</label>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-ink placeholder:text-[var(--text-muted)]"
                      placeholder="e.g. PROD-001"
                      value={form.sku}
                      onChange={(e) => setForm({ ...form, sku: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      className="shrink-0 rounded-lg border border-[var(--border-light)] px-2.5 py-2 text-[10px] text-[var(--text-mid)] hover:text-teal hover:border-teal/30 transition-all"
                      onClick={autoGenerateSku}
                      title="Auto-generate SKU"
                    >
                      Auto
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Purchase Price (৳)</label>
                  <input
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-ink"
                    type="number" min={0} step="0.01"
                    placeholder="0.00"
                    value={form.purchasePrice}
                    onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Selling Price (৳) *</label>
                  <input
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-ink"
                    type="number" min={0} step="0.01"
                    placeholder="0.00"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">VAT Type</label>
                  <select
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-ink"
                    value={form.vatType}
                    onChange={(e) => setForm({ ...form, vatType: e.target.value as "INCLUSIVE" | "EXCLUSIVE" })}
                  >
                    <option value="EXCLUSIVE">VAT Exclusive</option>
                    <option value="INCLUSIVE">VAT Inclusive</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">VAT Rate (%)</label>
                  <input
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-ink"
                    type="number" min={0} max={100} step="0.1"
                    placeholder="0"
                    value={form.vatRate}
                    onChange={(e) => setForm({ ...form, vatRate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Initial Stock *</label>
                  <input
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-ink"
                    type="number" min={0}
                    placeholder="0"
                    value={form.stockLevel}
                    onChange={(e) => setForm({ ...form, stockLevel: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Low Stock Alert Level</label>
                  <input
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-ink"
                    type="number" min={1}
                    placeholder="5"
                    value={form.lowStockAt}
                    onChange={(e) => setForm({ ...form, lowStockAt: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Brand / Importer Name</label>
                <input
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-ink placeholder:text-[var(--text-muted)]"
                  placeholder="e.g. Samsung, RFL, Pran"
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Category</label>
                <select
                  className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-ink"
                  value={form.subcategoryId}
                  onChange={(e) => setForm({ ...form, subcategoryId: e.target.value })}
                >
                  <option value="">No category</option>
                  {categories.map((c) => (
                    c.subcategories.length === 0 ? (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ) : (
                      c.subcategories.map((s) => (
                        <option key={s.id} value={s.id}>{c.name} › {s.name}</option>
                      ))
                    )
                  ))}
                </select>
              </div>

              {barcodeSvg && (
                <div className="rounded-lg border border-[var(--border-default)] bg-white p-3">
                  <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Barcode Preview</p>
                  <div dangerouslySetInnerHTML={{ __html: barcodeSvg }} />
                </div>
              )}
            </form>

            <div className="flex items-center gap-3 border-t border-[var(--border-default)] px-5 py-4 shrink-0">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-ink hover:bg-teal/90 transition-all disabled:opacity-50"
                onClick={handleSubmit}
              >
                {saving ? "Saving..." : form.id ? "Update Product" : "Add Product"}
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg border border-[var(--border-light)] px-4 py-2.5 text-sm text-[var(--text-default)] hover:bg-[var(--bg-card-hover)] transition-all"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
