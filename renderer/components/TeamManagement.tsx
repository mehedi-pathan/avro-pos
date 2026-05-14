"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { avroApi } from "@/lib/api";
import type { Role, StaffUser } from "@/lib/types";

function generateStaffId(displayName: string, joinedAt: string, index: number): string {
  const year = joinedAt ? new Date(joinedAt).getFullYear() : new Date().getFullYear();
  const namePart = displayName
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 4)
    .toUpperCase();
  const num = String(index + 1).padStart(3, "0");
  return `AV-${year}-${namePart}-${num}`;
}

export function TeamManagement() {
  const { user, hasCapability } = useAuth();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    password: "",
    role: "SALESMAN" as Role
  });
  const [showForm, setShowForm] = useState(false);
  const [generatedId, setGeneratedId] = useState("");

  async function loadStaff() {
    setStaff(await avroApi().listUsers());
  }

  useEffect(() => {
    if (hasCapability("TEAM_MANAGE")) {
      loadStaff().catch((error) => setMessage(error.message));
    }
  }, [hasCapability]);

  useEffect(() => {
    if (form.displayName.trim()) {
      const nextIndex = staff.length;
      const id = generateStaffId(form.displayName, new Date().toISOString(), nextIndex);
      setGeneratedId(id);
    } else {
      setGeneratedId("");
    }
  }, [form.displayName, staff.length]);

  async function createStaff(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const newUser = await avroApi().createUser({
        actorId: user?.id,
        username: form.username,
        displayName: form.displayName,
        password: form.password,
        role: form.role,
        joinedAt: new Date().toISOString()
      });
      setForm({ username: "", displayName: "", password: "", role: "SALESMAN" });
      setShowForm(false);
      await loadStaff();
      setMessage(`Staff account created. Staff ID: ${newUser.staffId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create staff account.");
    }
  }

  async function updateStaff(target: StaffUser, patch: Partial<Pick<StaffUser, "role" | "isActive">>) {
    setMessage("");
    try {
      await avroApi().updateProfile({
        actorId: user?.id ?? "",
        actorRole: user?.role,
        targetUserId: target.id,
        ...patch
      });
      await loadStaff();
      setMessage("Staff profile updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update staff profile.");
    }
  }

  if (!hasCapability("TEAM_MANAGE")) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8 text-sm text-[var(--text-mid)] backdrop-blur-xl">
          Owner access required.
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

      <div className="flex flex-1 gap-5 overflow-hidden">
        <AnimatePresence>
          {showForm && (
            <motion.form
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="shrink-0 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 backdrop-blur-xl"
              onSubmit={createStaff}
            >
              <div className="w-[340px]">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-semibold">Provision staff</h2>
                  <button type="button" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]" onClick={() => { setShowForm(false); setForm({ username: "", displayName: "", password: "", role: "SALESMAN" }); }}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {generatedId ? (
                  <div className="mb-4 rounded-lg border border-teal/30 bg-teal/5 px-3 py-2.5">
                    <p className="text-xs text-[var(--text-secondary)]">Staff ID preview</p>
                    <p className="mt-0.5 font-mono text-sm font-bold text-teal">{generatedId}</p>
                  </div>
                ) : null}

                <label className="mb-3 block text-sm">
                  Display name
                  <input className="mt-1 w-full rounded bg-[var(--bg-input)] px-3 py-2 text-ink" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} required />
                </label>
                <label className="mb-3 block text-sm">
                  Username
                  <input className="mt-1 w-full rounded bg-[var(--bg-input)] px-3 py-2 text-ink" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} required />
                </label>
                <label className="mb-3 block text-sm">
                  Temporary password
                  <input className="mt-1 w-full rounded bg-[var(--bg-input)] px-3 py-2 text-ink" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
                </label>
                <label className="mb-4 block text-sm">
                  Role
                  <select className="mt-1 w-full rounded bg-[var(--bg-input)] px-3 py-2 text-ink" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>
                    <option value="SALESMAN">Salesman</option>
                    <option value="MANAGER">Manager</option>
                  </select>
                </label>
                <div className="flex gap-2">
                  <button className="rounded bg-teal px-4 py-2 text-sm font-medium text-ink">Create account</button>
                  <button className="rounded border border-[var(--border-light)] px-4 py-2 text-sm" type="button" onClick={() => { setShowForm(false); setForm({ username: "", displayName: "", password: "", role: "SALESMAN" }); }}>Cancel</button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {staff.length} member{staff.length !== 1 ? "s" : ""}
            </p>
            {!showForm ? (
              <button className="rounded bg-teal px-3 py-1.5 text-xs font-medium text-ink" onClick={() => setShowForm(true)}>
                + Add member
              </button>
            ) : null}
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse text-left text-sm" style={{ tableLayout: "fixed" }}>
              <thead className="sticky top-0 z-10 bg-[var(--th-bg)] text-[var(--text-mid)] text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-3 font-medium w-[140px]">Staff ID</th>
                  <th className="p-3 font-medium">Name</th>
                  <th className="p-3 font-medium w-[100px]">Role</th>
                  <th className="p-3 font-medium w-[160px]">Last login</th>
                  <th className="p-3 font-medium w-[80px]">Status</th>
                  <th className="p-3 font-medium w-[100px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <tr className="border-t border-[var(--border-default)] hover:bg-[var(--bg-card)] transition-colors" key={member.id}>
                    <td className="p-3 font-mono text-xs text-teal font-medium">{member.staffId}</td>
                    <td className="p-3">
                      <p className="font-medium text-[var(--text-primary)]">{member.displayName}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{member.username}</p>
                    </td>
                    <td className="p-3">
                      {member.role === "OWNER" ? (
                        <span className="rounded bg-saffron/20 px-2 py-1 text-xs font-medium text-saffron">Owner</span>
                      ) : (
                        <select className="rounded bg-[var(--bg-input)] px-2 py-1 text-xs text-ink" value={member.role} onChange={(event) => updateStaff(member, { role: event.target.value as Role })}>
                          <option value="MANAGER">Manager</option>
                          <option value="SALESMAN">Salesman</option>
                        </select>
                      )}
                    </td>
                    <td className="p-3 text-xs text-[var(--text-default)]">
                      {member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleString() : "Never"}
                      {member.lastLoginIp ? <p className="text-xs text-[var(--text-tertiary)]">{member.lastLoginIp}</p> : null}
                    </td>
                    <td className="p-3">
                      <span className={`text-xs font-medium ${member.isActive ? "text-emerald-400" : "text-red-400"}`}>
                        {member.isActive ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {member.role !== "OWNER" ? (
                        <button
                          className={`rounded border px-2.5 py-1 text-xs transition-colors ${
                            member.isActive
                              ? "border-[var(--border-light)] text-[var(--text-mid)] hover:text-red-400"
                              : "border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10"
                          }`}
                          onClick={() => updateStaff(member, { isActive: !member.isActive })}
                        >
                          {member.isActive ? "Suspend" : "Restore"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {staff.length === 0 && (
              <div className="flex items-center justify-center py-16 text-sm text-[var(--text-muted)]">
                No staff members yet. Add your first team member.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
