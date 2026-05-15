"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { avroApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { UpdateBanner } from "@/components/UpdateBanner";
import { useTheme } from "@/hooks/useTheme";

const navItems = [
    { href: "/", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", capability: "CHECKOUT" as const },
    { href: "/checkout", label: "Checkout", icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z", capability: "CHECKOUT" as const },
    { href: "/customers", label: "Customers", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z", capability: "CHECKOUT" as const },
    { href: "/inventory", label: "Inventory", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", capability: "INVENTORY_READ" as const },
    { href: "/reports", label: "Reports", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", capability: "REPORTS" as const },
    { href: "/sales-history", label: "History", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", capability: "REPORTS" as const },
    { href: "/staff", label: "Staff", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z", capability: "TEAM_MANAGE" as const },
    { href: "/settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z", capability: "SETTINGS" as const },
    { href: "/about", label: "About", icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z", capability: "CHECKOUT" as const }
];

function isActive(pathname: string, href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
}

const pageVariants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: "easeIn" as const } }
};

export function MainLayout({ title, children }: { title: string; children: ReactNode }) {
    const { user, logout, hasCapability } = useAuth();
    const { theme, toggle: toggleTheme } = useTheme();
    const pathname = usePathname();
    const router = useRouter();
    const [heartbeat, setHeartbeat] = useState<{
        sqlite: string; latencyMs: number; lastCloudSyncAt: string | null;
        lastBackupAt: string | null; totalProducts: number; totalCategories: number;
        todaySales: number; checkedAt: string;
    } | null>(null);
    const [driveAuth, setDriveAuth] = useState<{ authenticated: boolean; email?: string } | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [backingUp, setBackingUp] = useState(false);
    const [isOnline, setIsOnline] = useState(true);
    const [clock, setClock] = useState("");
    const [dateStr, setDateStr] = useState("");
    const [updateInfo, setUpdateInfo] = useState<{ available: boolean; latestVersion: string } | null>(null);
    const [profileOpen, setProfileOpen] = useState(false);
    const [syncToast, setSyncToast] = useState<{ message: string; ok: boolean } | null>(null);

    useEffect(() => {
        const tick = () => {
            const now = new Date();
            setClock(now.toLocaleTimeString("en-BD", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }));
            setDateStr(now.toLocaleDateString("en-BD", { timeZone: "Asia/Dhaka", year: "numeric", month: "short", day: "numeric" }));
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
        return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
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

    useEffect(() => { checkDriveAuth(); }, [isOnline]);

    useEffect(() => {
        avroApi().checkForUpdate().then(r => setUpdateInfo(r)).catch(() => { });
    }, []);

    useEffect(() => {
        if (!syncToast) return;
        const t = window.setTimeout(() => setSyncToast(null), 3800);
        return () => window.clearTimeout(t);
    }, [syncToast]);

    async function checkDriveAuth() {
        try { setDriveAuth(await avroApi().getGoogleDriveAuthStatus()); } catch { setDriveAuth({ authenticated: false }); }
    }
    async function handleSync() {
        setSyncing(true);
        try {
            await avroApi().syncToDrive();
            setHeartbeat(await avroApi().heartbeat());
            setSyncToast({ ok: true, message: "Backup uploaded to Google Drive successfully." });
        } catch (e) {
            setSyncToast({
                ok: false,
                message: e instanceof Error ? e.message : "Could not upload backup to Drive.",
            });
        } finally {
            setSyncing(false);
        }
    }
    async function handleDriveAuth() {
        try { const r = await avroApi().authenticateWithGoogle(); setDriveAuth({ authenticated: true, email: r.email }); } catch { setDriveAuth({ authenticated: false }); }
    }
    async function handleDriveSignOut() { await avroApi().signOutFromGoogle(); setDriveAuth({ authenticated: false }); }
    async function handleBackup() {
        setBackingUp(true);
        try {
            const result = await avroApi().backupToDisk();
            if (result.ok) {
                setHeartbeat(await avroApi().heartbeat());
            }
        } finally {
            setBackingUp(false);
        }
    }

    const initials = user ? user.displayName.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2) : "?";

    return (
        <div className="h-screen w-screen p-1.5" style={{ background: "var(--bg-frame)" }}>
            <div className="flex h-full w-full flex-col overflow-hidden rounded-frame" style={{ background: "var(--bg-app)" }}>
                {/* Main row: sidebar + content */}
                <div className="flex flex-1 min-h-0">
                    {/* ─── Sidebar ─── */}
                    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-[var(--border-default)]" style={{ background: "var(--bg-sidebar)" }}>
                        {/* Logo */}
                        <div className="p-5 pb-4">
                            <div className="flex items-center gap-3">
                                <img src="/avro-logo.png" alt="Avro POS" className="h-9 w-9 rounded-lg shadow-lg shadow-teal/25" />
                                <div>
                                    <h1 className="text-sm font-bold tracking-tight text-[var(--text-primary)]">AVRO POS</h1>
                                    <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">Enterprise</p>
                                </div>
                            </div>
                        </div>

                        {/* Navigation */}
                        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 scrollable">
                            {navItems
                                .filter((item) => hasCapability(item.capability))
                                .map((item) => {
                                    const active = isActive(pathname, item.href);
                                    return (
                                        <Link
                                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all ${active
                                                ? "bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]"
                                                : "text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
                                                }`}
                                            href={item.href}
                                            key={item.href}
                                        >
                                            <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                                            </svg>
                                            {item.label}
                                            {active && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--nav-active-text)]" />}
                                        </Link>
                                    );
                                })}
                        </nav>

                        {/* System Status */}
                        <div className="mx-3 mb-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-overlay)] p-3">
                            <div className="flex items-center gap-2 text-[11px] mb-3">
                                <span className={`inline-block h-2 w-2 rounded-full ${isOnline && heartbeat?.sqlite === "online" && driveAuth?.authenticated ? "bg-emerald-400 animate-pulse-glow" : "bg-red-400 animate-pulse"}`} />
                                <span className="font-semibold text-[var(--text-primary)]">System Status</span>
                            </div>
                            
                            <div className="space-y-2.5">
                                {/* WiFi Status */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <svg className="h-3.5 w-3.5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                                        </svg>
                                        <span className="text-[11px] text-[var(--text-secondary)]">Network</span>
                                    </div>
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${isOnline ? "bg-emerald-400/10 text-emerald-500" : "bg-red-400/10 text-red-500"}`}>
                                        {isOnline ? "Online" : "Offline"}
                                    </span>
                                </div>

                                {/* SQLite Status */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <svg className="h-3.5 w-3.5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                                        </svg>
                                        <span className="text-[11px] text-[var(--text-secondary)]">Database</span>
                                    </div>
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${heartbeat?.sqlite === "online" ? "bg-emerald-400/10 text-emerald-500" : "bg-red-400/10 text-red-500"}`}>
                                        {heartbeat?.sqlite === "online" ? "Connected" : "Error"}
                                    </span>
                                </div>

                                {/* Backup Status */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <svg className="h-3.5 w-3.5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span className="text-[11px] text-[var(--text-secondary)]">Local Backup</span>
                                    </div>
                                    <span className="text-[10px] text-[var(--text-tertiary)]">
                                        {heartbeat?.lastBackupAt ? new Date(heartbeat.lastBackupAt).toLocaleString("en-BD", { timeZone: "Asia/Dhaka", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "Never"}
                                    </span>
                                </div>
                                <button className="w-full rounded-lg bg-teal/60 px-2 py-1.5 text-[10px] font-medium text-white transition hover:bg-teal/80 disabled:opacity-40" title="Create offline backup now" onClick={handleBackup} disabled={backingUp}>
                                    {backingUp ? "Backing up..." : "Backup Now"}
                                </button>

                                {/* Cloud Backup Status */}
                                <div className="flex items-center justify-between mt-2">
                                    <div className="flex items-center gap-2">
                                        <svg className="h-3.5 w-3.5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                                        </svg>
                                        <span className="text-[11px] text-[var(--text-secondary)]">Drive Backup</span>
                                    </div>
                                </div>
                                {driveAuth?.authenticated ? (
                                    <>
                                        <p className="text-[10px] text-[var(--text-tertiary)] truncate w-full" title={driveAuth.email}>{driveAuth.email}</p>
                                        <div className="mt-1.5 space-y-1">
                                            <button className="w-full rounded-lg bg-emerald-600/60 px-2 py-1 text-[10px] font-medium text-white transition hover:bg-emerald-600/80" onClick={handleSync} disabled={syncing}>
                                                {syncing ? "Syncing..." : "Sync Now"}
                                            </button>
                                            <button className="w-full rounded-lg bg-red-600/60 px-2 py-1 text-[10px] font-medium text-white transition hover:bg-red-600/80" onClick={handleDriveSignOut}>
                                                Disconnect
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <button className="w-full rounded-lg bg-blue-600/60 px-2 py-1.5 text-[10px] font-medium text-white transition hover:bg-blue-600/80 mt-1" onClick={handleDriveAuth}>
                                        Connect Google Drive
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* User Profile */}
                        <div className="border-t border-[var(--border-default)] p-3">
                            <button
                                className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-all hover:bg-[var(--bg-card)]"
                                onClick={() => setProfileOpen(!profileOpen)}
                            >
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-primary)] text-sm font-bold text-white">
                                    {initials}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{user?.displayName ?? "User"}</p>
                                    <p className="text-[11px] text-[var(--text-tertiary)]">{user?.role ?? "—"}</p>
                                </div>
                                <svg className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform ${profileOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {profileOpen && (
                                <div className="mt-1 space-y-1 animate-slide-up">
                                    <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)] transition hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]" onClick={toggleTheme}>
                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            {theme === "dark" ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />}
                                        </svg>
                                        {theme === "dark" ? "Light mode" : "Dark mode"}
                                    </button>
                                    <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[var(--text-secondary)] transition hover:bg-[var(--bg-card)] hover:text-red-400" onClick={() => { logout(); router.push("/"); }}>
                                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                        </svg>
                                        Sign out
                                    </button>
                                </div>
                            )}
                        </div>
                    </aside>

                    {/* ─── Content Area ─── */}
                    <div className="flex flex-1 flex-col overflow-hidden">
                        <UpdateBanner />

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={pathname}
                                variants={pageVariants}
                                initial="initial"
                                animate="animate"
                                exit="exit"
                                className="flex-1 overflow-auto scrollable"
                            >
                                <div className="p-5 min-h-full">{children}</div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>

                {/* ─── Footer Status Bar ─── */}
                <div className="flex h-9 shrink-0 items-center justify-between border-t border-[var(--border-default)] px-5 text-[11px]" style={{ background: "var(--footer-bg)" }}>
                    <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                        <span className="font-medium text-[var(--text-secondary)]">Local Backup</span>
                        <span>{heartbeat?.lastBackupAt ? new Date(heartbeat.lastBackupAt).toLocaleString("en-BD", { timeZone: "Asia/Dhaka", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "Never"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                        <span className="font-medium text-[var(--text-secondary)]">Database</span>
                        <span className="flex items-center gap-1">
                            <span className={`inline-block h-1.5 w-1.5 rounded-full ${heartbeat?.sqlite === "online" ? "bg-emerald-400" : "bg-red-400"}`} />
                            {heartbeat?.sqlite === "online" ? "Connected" : heartbeat?.sqlite ?? "checking…"}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                        <span className="font-medium text-[var(--text-secondary)]">Version 2.0.3</span>
                        {updateInfo === null ? (
                            <span className="text-amber-400">Checking…</span>
                        ) : updateInfo.available ? (
                            <span className="text-amber-400">v{updateInfo.latestVersion} available</span>
                        ) : (
                            <span className="flex items-center gap-1 text-emerald-400">
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                You&apos;re up to date
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {syncToast ? (
                <div
                    className="pointer-events-none fixed bottom-12 right-5 z-[300] max-w-sm"
                    role="status"
                >
                    <div
                        className={`pointer-events-auto rounded-xl border px-4 py-2.5 text-[13px] font-medium shadow-xl ${
                            syncToast.ok
                                ? "border-emerald-500/45 bg-[var(--bg-card)] text-emerald-600 dark:text-emerald-400"
                                : "border-red-500/45 bg-[var(--bg-card)] text-red-600 dark:text-red-400"
                        }`}
                    >
                        {syncToast.message}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
