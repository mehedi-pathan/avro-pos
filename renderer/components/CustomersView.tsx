"use client";

import { useEffect, useState } from "react";
import { avroApi } from "@/lib/api";
import type { Customer } from "@/lib/types";
import { motion } from "framer-motion";

export function CustomersView() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", phone: "", email: "" });
  const [submitting, setSubmitting] = useState(false);

  const loadCustomers = async () => {
    try {
      const data = await avroApi().listCustomers();
      setCustomers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleOpenModal = (c?: Customer) => {
    if (c) {
      setForm({ id: c.id, name: c.name, phone: c.phone, email: c.email || "" });
    } else {
      setForm({ id: "", name: "", phone: "", email: "" });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await avroApi().upsertCustomer({
        id: form.id || undefined,
        name: form.name,
        phone: form.phone,
        email: form.email || null,
      });
      setShowModal(false);
      loadCustomers();
    } catch (err) {
      console.error(err);
      alert("Failed to save customer. Phone number might already exist.");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Customers</h1>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">Manage your customer relationships and loyalty points.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 flex items-center gap-2 transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Customer
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 shrink-0 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-card)] p-4">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]">
          <svg className="h-4 w-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search customers by name or phone..."
            className="w-full bg-transparent focus:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-card)] flex flex-col">
        <div className="overflow-x-auto flex-1 scrollable">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[var(--bg-overlay)] text-[12px] uppercase text-[var(--text-secondary)] sticky top-0 z-10">
              <tr>
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-5 py-3 font-semibold">Contact Info</th>
                <th className="px-5 py-3 font-semibold text-center">Loyalty Points</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)] text-[var(--text-primary)]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[var(--text-muted)]">Loading customers...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-[var(--text-muted)]">No customers found.</td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-[var(--bg-card-hover)] transition-colors">
                    <td className="px-5 py-3 font-medium">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-primary)]/10 text-xs font-bold text-[var(--accent-primary)]">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        {c.name}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <p>{c.phone}</p>
                      {c.email && <p className="text-[11px] text-[var(--text-tertiary)]">{c.email}</p>}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/15 px-2 py-1 text-xs font-semibold text-amber-500">
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        {c.points}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => handleOpenModal(c)} className="text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)]">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm rounded-2xl border border-[var(--border-default)] shadow-2xl overflow-hidden" style={{ background: "var(--bg-app)" }}>
            <div className="flex items-center justify-between border-b border-[var(--border-default)] p-4" style={{ background: "var(--bg-card)" }}>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">{form.id ? "Edit Customer" : "Add Customer"}</h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 hover:bg-[var(--bg-overlay)] text-[var(--text-muted)]">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Name</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none" placeholder="John Doe" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Phone Number</label>
                <input type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none" placeholder="017xxxxxxxx" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Email Address (Optional)</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none" placeholder="john@example.com" />
              </div>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-xl border border-[var(--border-default)] py-2 text-sm font-medium hover:bg-[var(--bg-card)]">Cancel</button>
                <button type="submit" disabled={submitting} className="flex-1 rounded-xl bg-[var(--accent-primary)] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                  {submitting ? "Saving..." : "Save Customer"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
