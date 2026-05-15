"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { avroApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { APP_VERSION } from "@/lib/version";

const navItems = [
  { href: "/", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", capability: "CHECKOUT" as const },
  { href: "/checkout", label: "Checkout", icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z", capability: "CHECKOUT" as const },
  { href: "/sales-history", label: "Sales History", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", capability: "REPORTS" as const },
  { href: "/inventory", label: "Inventory", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", capability: "INVENTORY_READ" as const },
  { href: "/staff", label: "Staff", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z", capability: "TEAM_MANAGE" as const },
  { href: "/settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z", capability: "SETTINGS" as const }
];

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { user, logout, hasCapability } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const router = useRouter();
  const [heartbeat, setHeartbeat] = useState<{
    sqlite: string;
    latencyMs: number;
    lastCloudSyncAt: string | null;
    lastBackupAt: string | null;
    totalProducts: number;
    totalCategories: number;
    todaySales: number;
    checkedAt: string;
  } | null>(null);
  const [driveAuth, setDriveAuth] = useState<{ authenticated: boolean; email?: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [clock, setClock] = useState("");
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setDateStr(now.toLocaleDateString([], { weekday: "short", year: "numeric", month: "short", day: "numeric" }));
    };
    tick();
    const ti = setInterval(tick, 1000);
    return () => clearInterval(ti);
  }, []);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const result = await avroApi().heartbeat();
        if (active) setHeartbeat(result);
      } catch {
        if (active) setHeartbeat({ sqlite: "offline", latencyMs: 0, lastCloudSyncAt: null, lastBackupAt: null, totalProducts: 0, totalCategories: 0, todaySales: 0, checkedAt: new Date().toISOString() });
      }
    }
    check();
    const timer = window.setInterval(check, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    checkDriveAuth();
  }, [isOnline]);

  async function checkDriveAuth() {
    try {
      const status = await avroApi().getGoogleDriveAuthStatus();
      setDriveAuth(status);
    } catch {
      setDriveAuth({ authenticated: false });
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      await avroApi().syncToDrive();
      const hb = await avroApi().heartbeat();
      setHeartbeat(hb);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDriveAuth() {
    try {
      const result = await avroApi().authenticateWithGoogle();
      setDriveAuth({ authenticated: true, email: result.email });
    } catch {
      setDriveAuth({ authenticated: false });
    }
  }

  async function handleDriveSignOut() {
    await avroApi().signOutFromGoogle();
    setDriveAuth({ authenticated: false });
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-app)" }}>
      <div className="grid min-h-screen text-[var(--text-primary)] lg:grid-cols-[260px_1fr]">
        <aside className="flex flex-col border-[var(--border-default)] bg-[var(--bg-card)] shadow-2xl backdrop-blur-xl lg:border-r">
          <div className="p-5">
            <div className="mb-6 flex items-center gap-3">
              <img src="/avro-logo.png" alt="Avro POS" className="h-9 w-9 rounded-lg shadow-lg shadow-teal/25" />
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-muted)]">Enterprise POS</p>
                <h1 className="text-lg font-semibold text-[var(--text-primary)]">Avro POS</h1>
              </div>
            </div>
            <nav className="space-y-1">
              {navItems
                .filter((item) => hasCapability(item.capability))
                .map((item) => (
                  <Link
                    className="flex items-center gap-3 rounded border border-transparent px-3 py-2.5 text-sm text-[var(--text-default)] transition-all hover:border-[var(--border-default)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
                    href={item.href}
                    key={item.href}
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    {item.label}
                  </Link>
                ))}
            </nav>
          </div>

          <div className="mt-auto border-t border-[var(--border-default)] p-5">
            <div className="mb-3 rounded border border-[var(--border-default)] bg-[var(--bg-overlay)] p-3 text-xs text-[var(--text-default)]">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-primary)]">Internet</span>
                <span className={isOnline ? "text-emerald-300" : "text-red-300"}>{isOnline ? "Online" : "Offline"}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[var(--text-primary)]">Database</span>
                <span className={heartbeat?.sqlite === "online" ? "text-emerald-300" : "text-red-300"}>{heartbeat?.sqlite === "online" ? "Online" : (heartbeat?.sqlite ?? "checking")}</span>
              </div>
              {heartbeat ? (
                <>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[var(--text-primary)]">Products</span>
                    <span>{heartbeat.totalProducts}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[var(--text-primary)]">Categories</span>
                    <span>{heartbeat.totalCategories}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[var(--text-primary)]">Today sales</span>
                    <span>{heartbeat.todaySales}</span>
                  </div>
                  <div className="mt-1.5">
                    <span className="text-[var(--text-primary)]">Last backup</span>
                    <p className="mt-0.5 break-words text-[var(--text-secondary)]">
                      {heartbeat.lastBackupAt ? new Date(heartbeat.lastBackupAt).toLocaleString() : "Never backed up"}
                    </p>
                  </div>
                  <div className="mt-1.5">
                    <span className="text-[var(--text-primary)]">Drive sync</span>
                    <p className="mt-0.5 break-words text-[var(--text-secondary)]">
                      {heartbeat.lastCloudSyncAt ? new Date(heartbeat.lastCloudSyncAt).toLocaleString() : "Never synced"}
                    </p>
                    {driveAuth ? (
                      driveAuth.authenticated ? (
                        <div className="mt-1.5 space-y-1">
                          <p className="truncate text-[10px] text-teal/70">{driveAuth.email}</p>
                          <div className="flex gap-1">
                            <button
                              className="flex-1 rounded bg-teal/60 px-2 py-1 text-[10px] text-white transition hover:bg-teal/80 disabled:opacity-40"
                              onClick={handleSync}
                              disabled={syncing}
                            >
                              {syncing ? "Syncing..." : "Sync now"}
                            </button>
                            <button
                              className="rounded border border-[var(--border-default)] px-2 py-1 text-[10px] text-[var(--text-muted)] transition hover:bg-[var(--bg-card)]"
                              onClick={handleDriveSignOut}
                            >
                              Disconnect
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="mt-1.5 w-full rounded bg-teal/60 px-2 py-1 text-[10px] text-white transition hover:bg-teal/80"
                          onClick={handleDriveAuth}
                        >
                          Connect Google Drive
                        </button>
                      )
                    ) : (
                      <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">Checking...</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="mt-1.5 text-[var(--text-muted)]">Loading...</div>
              )}
            </div>

            <button
              className="flex w-full items-center gap-2 rounded border border-[var(--border-default)] px-3 py-2 text-xs text-[var(--text-mid)] transition-all hover:bg-[var(--bg-card)]"
              onClick={toggleTheme}
            >
              {theme === "dark" ? (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>

            {user && (
              <button
                className="mt-2 flex w-full items-center gap-2 rounded border border-[var(--border-default)] px-3 py-2 text-xs text-[var(--text-mid)] transition-all hover:bg-[var(--bg-card)]"
                onClick={() => { logout(); router.push("/"); }}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            )}

            <p className="mt-4 text-center text-[10px] text-[var(--text-muted)]">
              Avro POS v{APP_VERSION}<br />
              Developed by <a href="https://mehedipathan.online" target="_blank" rel="noopener noreferrer" className="text-teal/60 hover:text-teal">Mehedi Pathan</a>
            </p>
          </div>
        </aside>

        <section className="flex flex-col p-4 lg:p-6">
          <header className="mb-4 flex items-center justify-between rounded border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
              {user ? (
                <span className="hidden text-xs text-[var(--text-secondary)] md:inline">
                  {user.displayName} &bull; {user.role}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 text-xs text-[var(--text-mid)] sm:flex">
                <span className="font-mono text-[var(--text-tertiary)]">{dateStr}</span>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-mono tabular-nums">{clock}</span>
              </div>
            </div>
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
