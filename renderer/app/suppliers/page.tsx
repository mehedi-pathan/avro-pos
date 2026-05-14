"use client";

import { FormEvent, useEffect, useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { useAuth } from "@/hooks/useAuth";
import { avroApi } from "@/lib/api";

export default function SuppliersPage() {
  const { user, hasCapability } = useAuth();
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string; contactPerson: string | null; email: string | null; phone: string | null; address: string | null; notes: string | null; createdAt: string; updatedAt: string }>>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ name: "", contactPerson: "", email: "", phone: "", address: "", notes: "" });
  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadSuppliers() {
    try {
      setSuppliers(await avroApi().listSuppliers());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load suppliers.");
    }
  }

  useEffect(() => {
    if (hasCapability("INVENTORY_READ")) {
      loadSuppliers();
    }
  }, [hasCapability]);

  async function saveSupplier(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const payload: { actorId?: string; id?: string; name: string; contactPerson?: string; email?: string; phone?: string; address?: string; notes?: string } = {
        actorId: user?.id,
        name: form.name,
        contactPerson: form.contactPerson || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        notes: form.notes || undefined
      };
      if (editingId) payload.id = editingId;
      await avroApi().upsertSupplier(payload);
      setForm({ name: "", contactPerson: "", email: "", phone: "", address: "", notes: "" });
      setEditingId(null);
      await loadSuppliers();
      setMessage(editingId ? "Supplier updated." : "Supplier created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save supplier.");
    }
  }

  function editSupplier(supplier: typeof suppliers[number]) {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name,
      contactPerson: supplier.contactPerson ?? "",
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      address: supplier.address ?? "",
      notes: supplier.notes ?? ""
    });
  }

  async function removeSupplier(id: string) {
    setMessage("");
    try {
      await avroApi().deleteSupplier(id);
      await loadSuppliers();
      setMessage("Supplier deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete supplier.");
    }
  }

  if (!hasCapability("INVENTORY_READ")) {
    return (
      <MainLayout title="Suppliers">
        <div className="rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-5 backdrop-blur-xl">Manager or Owner access required.</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Supplier Management">
      {message ? <p className="mb-4 rounded border border-[var(--border-default)] bg-[var(--bg-overlay)] p-3 text-sm text-[var(--text-message)]">{message}</p> : null}
      <div className="flex h-full flex-col gap-5 lg:flex-row">
        <form className="w-full self-start rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 backdrop-blur-xl lg:w-[360px] lg:shrink-0" onSubmit={saveSupplier}>
          <h2 className="mb-4 font-semibold">{editingId ? "Edit supplier" : "Add supplier"}</h2>
          <label className="mb-3 block text-sm">
            Company name
            <input className="mt-1 w-full rounded bg-[var(--bg-input)] px-3 py-2 text-ink" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label className="mb-3 block text-sm">
            Contact person
            <input className="mt-1 w-full rounded bg-[var(--bg-input)] px-3 py-2 text-ink" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
          </label>
          <label className="mb-3 block text-sm">
            Email
            <input className="mt-1 w-full rounded bg-[var(--bg-input)] px-3 py-2 text-ink" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="mb-3 block text-sm">
            Phone
            <input className="mt-1 w-full rounded bg-[var(--bg-input)] px-3 py-2 text-ink" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label className="mb-3 block text-sm">
            Address
            <input className="mt-1 w-full rounded bg-[var(--bg-input)] px-3 py-2 text-ink" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </label>
          <label className="mb-4 block text-sm">
            Notes
            <textarea className="mt-1 w-full rounded bg-[var(--bg-input)] px-3 py-2 text-ink" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          <div className="flex gap-2">
            <button className="rounded bg-teal px-4 py-2 text-sm font-medium text-ink">{editingId ? "Update" : "Save"}</button>
            {editingId ? <button className="rounded border border-[var(--border-light)] px-4 py-2 text-sm" type="button" onClick={() => { setEditingId(null); setForm({ name: "", contactPerson: "", email: "", phone: "", address: "", notes: "" }); }}>Cancel</button> : null}
          </div>
        </form>

        <section className="min-w-0 flex-1 overflow-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] backdrop-blur-xl">
          <table className="w-full min-w-[500px] text-left text-sm" style={{ tableLayout: "fixed" }}>
            <thead className="sticky top-0 z-10 bg-[var(--th-bg)] text-[var(--text-mid)] text-xs uppercase tracking-wider">
              <tr>
                <th className="p-3 font-medium">Company</th>
                <th className="p-3 font-medium">Contact</th>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Phone</th>
                <th className="p-3 font-medium w-[120px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr className="border-t border-[var(--border-default)] hover:bg-[var(--bg-card)] transition-colors" key={s.id}>
                  <td className="p-3 font-medium text-[var(--text-primary)] truncate">{s.name}</td>
                  <td className="p-3 text-[var(--text-default)] truncate">{s.contactPerson ?? "-"}</td>
                  <td className="p-3 text-[var(--text-default)] truncate">{s.email ?? "-"}</td>
                  <td className="p-3 text-[var(--text-default)]">{s.phone ?? "-"}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button className="rounded border border-[var(--border-light)] px-2.5 py-1 text-xs hover:bg-[var(--bg-card)]" onClick={() => editSupplier(s)}>Edit</button>
                      <button className="rounded border border-[var(--border-light)] px-2.5 py-1 text-xs text-red-400 hover:bg-red-400/10" onClick={() => removeSupplier(s.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </MainLayout>
  );
}
