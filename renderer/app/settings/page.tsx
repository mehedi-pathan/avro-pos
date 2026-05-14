"use client";

import { FormEvent, useEffect, useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { useAuth } from "@/hooks/useAuth";
import { avroApi } from "@/lib/api";
import type { BusinessSettings } from "@/lib/types";

export default function SettingsPage() {
  const { user, hasCapability } = useAuth();
  const [settings, setSettings] = useState<BusinessSettings>({
    businessName: "",
    address: "",
    taxId: "",
    currencySymbol: "৳",
    lowStockEmail: "",
    taxRate: "5",
    lastCloudSyncAt: null
  });
  const [profile, setProfile] = useState({ displayName: "", avatarUrl: "", password: "" });
  const [message, setMessage] = useState("");
  const [backupSchedule, setBackupSchedule] = useState({ active: false });
  const [backupInterval, setBackupInterval] = useState("60");

  useEffect(() => {
    avroApi()
      .getSettings()
      .then(setSettings)
      .catch((error) => setMessage(error.message));
    if (user) {
      setProfile({ displayName: user.displayName, avatarUrl: user.avatarUrl ?? "", password: "" });
    }
    avroApi().getBackupScheduleStatus().then(setBackupSchedule).catch(() => {});
  }, [user]);

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      setSettings(await avroApi().updateSettings({ ...settings, actorId: user?.id }));
      setMessage("Settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save settings.");
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setMessage("");
    try {
      await avroApi().updateProfile({
        actorId: user.id,
        actorRole: user.role,
        targetUserId: user.id,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl || null,
        password: profile.password || undefined
      });
      setMessage("Profile saved. Sign in again to refresh the active session.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save profile.");
    }
  }

  async function lowStockEmail() {
    setMessage("");
    try {
      const result = await avroApi().sendLowStockEmail();
      setMessage(`Low-stock email opened for ${result.count} products.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open low-stock email.");
    }
  }

  async function toggleAutoBackup() {
    setMessage("");
    try {
      if (backupSchedule.active) {
        const status = await avroApi().stopScheduledBackup();
        setBackupSchedule(status);
        setMessage("Auto-backup stopped.");
      } else {
        const intervalMs = parseInt(backupInterval) * 60 * 1000;
        const status = await avroApi().scheduleBackup(intervalMs);
        setBackupSchedule(status);
        setMessage(`Auto-backup scheduled every ${backupInterval} minutes.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Backup scheduling failed.");
    }
  }

  return (
    <MainLayout title="User Settings">
      <div className="flex h-full flex-col gap-5 xl:flex-row">
        <div className="flex w-full flex-col gap-5 xl:w-[420px] xl:shrink-0">
          <form className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 backdrop-blur-xl" onSubmit={saveProfile}>
            <h2 className="mb-4 font-semibold">My profile</h2>
            <label className="mb-3 block text-sm">
              Display name
              <input className="mt-1 w-full rounded bg-[var(--bg-input)] px-3 py-2 text-ink" value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} />
            </label>
            <label className="mb-3 block text-sm">
              Avatar URL
              <input className="mt-1 w-full rounded bg-[var(--bg-input)] px-3 py-2 text-ink" value={profile.avatarUrl} onChange={(event) => setProfile({ ...profile, avatarUrl: event.target.value })} />
            </label>
            <label className="mb-4 block text-sm">
              New password
              <input className="mt-1 w-full rounded bg-[var(--bg-input)] px-3 py-2 text-ink" type="password" value={profile.password} onChange={(event) => setProfile({ ...profile, password: event.target.value })} />
            </label>
            <button className="rounded bg-teal px-4 py-2 text-sm font-medium text-ink">Save profile</button>
          </form>

          {hasCapability("SETTINGS") ? (
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 backdrop-blur-xl">
              <h2 className="mb-4 font-semibold">Database backup scheduling</h2>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  Every
                  <select className="rounded bg-[var(--bg-input)] px-2 py-1.5 text-ink" value={backupInterval} onChange={(e) => setBackupInterval(e.target.value)}>
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="180">3 hours</option>
                    <option value="360">6 hours</option>
                    <option value="720">12 hours</option>
                    <option value="1440">24 hours</option>
                  </select>
                </label>
                <button
                  className={`rounded px-4 py-1.5 text-sm font-medium ${backupSchedule.active ? "border border-red-400 text-red-400 hover:bg-red-400/10" : "bg-teal text-ink hover:bg-teal/80"}`}
                  onClick={toggleAutoBackup}
                >
                  {backupSchedule.active ? "Stop auto-backup" : "Start auto-backup"}
                </button>
              </div>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {backupSchedule.active ? "Auto-backup is running in the background." : "No scheduled backup active."}
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex-1">
          {hasCapability("SETTINGS") ? (
            <form className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 backdrop-blur-xl" onSubmit={saveSettings}>
              <h2 className="mb-4 font-semibold">Business settings</h2>
              <div className="grid gap-x-6 gap-y-0 md:grid-cols-2">
                {[
                  { key: "businessName" as const, label: "Business name", type: "text", ph: "Your store name" },
                  { key: "address" as const, label: "Address", type: "text", ph: "Full business address" },
                  { key: "taxId" as const, label: "Tax ID / VAT Number", type: "text", ph: "e.g. BIN or VAT reg no" },
                  { key: "currencySymbol" as const, label: "Currency symbol", type: "text", ph: "e.g. ৳, $, ฿" },
                  { key: "taxRate" as const, label: "Default tax rate (%)", type: "number", ph: "e.g. 5" },
                  { key: "lowStockEmail" as const, label: "Low stock alert email", type: "email", ph: "admin@example.com" },
                ].map(({ key, label, type, ph }) => (
                  <label className="mb-3 block text-sm" key={key}>
                    {label}
                    <input className="mt-1 w-full rounded bg-[var(--bg-input)] px-3 py-2 text-ink" type={type} placeholder={ph} value={settings[key] ?? ""} onChange={(event) => setSettings({ ...settings, [key]: event.target.value })} />
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded bg-teal px-4 py-2 text-sm font-medium text-ink">Save settings</button>
                <button className="rounded border border-[var(--border-light)] px-4 py-2 text-sm" type="button" onClick={lowStockEmail}>
                  Low-stock email
                </button>
              </div>
              <p className="mt-3 text-sm text-[var(--text-muted)]">Last cloud sync: {settings.lastCloudSyncAt ? new Date(settings.lastCloudSyncAt).toLocaleString() : "Never"}</p>
            </form>
          ) : null}
        </div>
      </div>
      {message ? <p className="mt-4 rounded border border-[var(--border-default)] bg-[var(--bg-overlay)] p-3 text-sm text-[var(--text-message)]">{message}</p> : null}
    </MainLayout>
  );
}
