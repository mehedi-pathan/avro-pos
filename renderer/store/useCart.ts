"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Customer, Product } from "@/lib/types";

export type CartLine = {
  product: Product;
  quantity: number;
};

type CartState = {
  lines: CartLine[];
  customer: Customer | null;
  discount: number;
  taxRate: number;
  parkedCarts: Array<{ id: string; label: string; lines: CartLine[]; customer: Customer | null; discount: number; taxRate: number; parkedAt: string }>;
  addProduct: (product: Product) => void;
  addBySku: (sku: string, products: Product[]) => boolean;
  setQuantity: (productId: string, quantity: number) => void;
  removeProduct: (productId: string) => void;
  setCustomer: (customer: Customer | null) => void;
  setDiscount: (discount: number) => void;
  setTaxRate: (rate: number) => void;
  parkCart: (label?: string) => void;
  restoreCart: (id: string) => void;
  clear: () => void;
  subtotal: () => number;
  tax: () => number;
  total: () => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      customer: null,
      discount: 0,
      taxRate: 5,
      parkedCarts: [],
      addProduct: (product) =>
        set((state) => {
          const current = state.lines.find((line) => line.product.id === product.id);
          if (current) {
            return {
              lines: state.lines.map((line) =>
                line.product.id === product.id
                  ? { ...line, quantity: Math.min(line.quantity + 1, line.product.stockLevel) }
                  : line
              )
            };
          }

          return { lines: [...state.lines, { product, quantity: 1 }] };
        }),
      addBySku: (sku, products) => {
        const product = products.find((item) => item.sku.toLowerCase() === sku.trim().toLowerCase());
        if (!product) {
          return false;
        }
        get().addProduct(product);
        return true;
      },
      setQuantity: (productId, quantity) =>
        set((state) => ({
          lines: state.lines
            .map((line) =>
              line.product.id === productId
                ? { ...line, quantity: Math.max(1, Math.min(quantity, line.product.stockLevel)) }
                : line
            )
            .filter((line) => line.quantity > 0)
        })),
      removeProduct: (productId) =>
        set((state) => ({
          lines: state.lines.filter((line) => line.product.id !== productId)
        })),
      setCustomer: (customer) => set({ customer }),
      setDiscount: (discount) => set({ discount: Math.max(0, discount) }),
      setTaxRate: (taxRate) => set({ taxRate: Math.max(0, Math.min(100, taxRate)) }),
      parkCart: (label) =>
        set((state) => {
          if (!state.lines.length) return state;
          return {
            lines: [],
            customer: null,
            discount: 0,
            taxRate: 5,
            parkedCarts: [
              ...state.parkedCarts,
              {
                id: crypto.randomUUID(),
                label: label || state.customer?.name || `Cart ${state.parkedCarts.length + 1}`,
                lines: state.lines,
                customer: state.customer,
                discount: state.discount,
                taxRate: state.taxRate,
                parkedAt: new Date().toISOString()
              }
            ]
          };
        }),
      restoreCart: (id) =>
        set((state) => {
          const parked = state.parkedCarts.find((cart) => cart.id === id);
          if (!parked) return state;
          return {
            lines: parked.lines,
            customer: parked.customer,
            discount: parked.discount,
            taxRate: parked.taxRate,
            parkedCarts: state.parkedCarts.filter((cart) => cart.id !== id)
          };
        }),
      clear: () => set({ lines: [], customer: null, discount: 0, taxRate: 5 }),
      subtotal: () => get().lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
      tax: () => Math.max(0, get().subtotal() - get().discount) * (get().taxRate / 100),
      total: () => Math.max(0, get().subtotal() - get().discount) + get().tax()
    }),
    { name: "avro-pos-carts" }
  )
);
