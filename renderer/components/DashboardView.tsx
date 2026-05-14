"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from "recharts";
import { bdMoney } from "@/lib/bdFormat";
import { useAuth } from "@/hooks/useAuth";
import { avroApi } from "@/lib/api";

type DashboardStats = {
  todayRevenue: number;
  yesterdayRevenue: number;
  revenueChange: number;
  todayCount: number;
  yesterdayCount: number;
  orderChange: number;
  totalItemsSold: number;
  newCustomers: number;
  hourlyData: Array<{ hour: string; revenue: number }>;
  topProducts: Array<{ productId: string; name: string; imagePath: string | null; unitsSold: number; revenue: number }>;
  lowStock: Array<{ id: string; name: string; sku: string; stockLevel: number; lowStockAt: number; imagePath: string | null }>;
  recentActivity: Array<{ id: string; type: string; description: string; amount: number | null; createdAt: string }>;
};

const sparklineData = [
  { v: 4 }, { v: 7 }, { v: 3 }, { v: 9 }, { v: 6 }, { v: 11 }, { v: 8 }, { v: 13 },
  { v: 10 }, { v: 15 }, { v: 12 }, { v: 18 }, { v: 14 }, { v: 20 }, { v: 17 }, { v: 22 },
  { v: 19 }, { v: 24 }, { v: 21 }, { v: 27 }, { v: 23 }, { v: 29 }, { v: 25 }, { v: 32 },
];

const cardColors = [
  { line: "#247b7b", bg: "rgba(36,123,123,0.12)", icon: "M12 2c3 0 6 2 6 6 0 4-6 10-6 10S6 12 6 8c0-4 3-6 6-6z" },
  { line: "#6366F1", bg: "rgba(99,102,241,0.12)", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { line: "#e5a936", bg: "rgba(229,169,54,0.12)", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { line: "#b66b4d", bg: "rgba(182,107,77,0.12)", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
];

const trendSparkData = [
  { v: 40 }, { v: 55 }, { v: 45 }, { v: 70 }, { v: 60 }, { v: 85 }, { v: 75 }, { v: 90 },
  { v: 100 }, { v: 95 }, { v: 110 }, { v: 105 }, { v: 120 }, { v: 115 }, { v: 130 }, { v: 125 },
  { v: 140 }, { v: 135 }, { v: 150 }, { v: 145 }, { v: 160 }, { v: 155 }, { v: 170 }, { v: 165 },
];

export function DashboardView() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [heartbeat, setHeartbeat] = useState<{ sqlite: string; lastBackupAt: string | null } | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{ available: boolean; latestVersion: string } | null>(null);
  const [clock, setClock] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [timeFilter, setTimeFilter] = useState<"today" | "weekly" | "monthly">("today");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("en-BD", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }));
      setDateStr(now.toLocaleDateString("en-BD", { timeZone: "Asia/Dhaka", weekday: "short", year: "numeric", month: "short", day: "numeric" }));
    };
    tick();
    const ti = setInterval(tick, 1000);
    return () => clearInterval(ti);
  }, []);

  useEffect(() => {
    if (user) {
      avroApi().getDashboardStats().then(setStats).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetch = () => {
      avroApi().heartbeat().then(h => setHeartbeat({ sqlite: h.sqlite, lastBackupAt: h.lastBackupAt })).catch(() => {});
      avroApi().checkForUpdate().then(r => setUpdateInfo(r)).catch(() => {});
    };
    fetch();
    const ti = setInterval(fetch, 60000);
    return () => clearInterval(ti);
  }, [user]);

  const areaData = useMemo(() => {
    if (!stats) return [];
    return timeFilter === "today"
      ? stats.hourlyData
      : timeFilter === "weekly"
      ? Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return { hour: d.toLocaleDateString("en-BD", { weekday: "short" }), revenue: Math.floor(Math.random() * 10000 + 2000) };
        })
      : Array.from({ length: 30 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (29 - i));
          return { hour: d.toLocaleDateString("en-BD", { month: "short", day: "numeric" }), revenue: Math.floor(Math.random() * 8000 + 1000) };
        });
  }, [stats, timeFilter]);

  const TrendTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 shadow-xl text-xs">
          <p className="text-[var(--text-muted)] mb-1">{label}</p>
          <p className="font-bold text-[var(--text-primary)]">{bdMoney(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  if (!user) return null;

  const cards = [
    { label: "Today's Sales", value: bdMoney(stats?.todayRevenue ?? 0), change: stats?.revenueChange, prefix: "" },
    { label: "Total Orders", value: String(stats?.todayCount ?? 0), change: stats?.orderChange, prefix: "" },
    { label: "Items Sold", value: String(stats?.totalItemsSold ?? 0), change: null, prefix: "" },
    { label: "New Customers", value: String(stats?.newCustomers ?? 0), change: null, prefix: "" },
  ];

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto pr-1">
      {/* Header */}
      <div className="flex items-start justify-between shrink-0 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Dashboard</h1>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            {greeting}, {user.displayName}! Here&apos;s what&apos;s happening with your store today.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-[var(--text-mid)]">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="font-medium text-[var(--text-primary)]">{dateStr}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-mid)]">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-mono tabular-nums text-[var(--text-primary)]">{clock} BST</span>
          </div>
          <button className="relative rounded-lg p-2 text-[var(--text-mid)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-all">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">3</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 shrink-0">
        {cards.map((card, i) => (
          <div key={card.label} className="relative overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 shadow-[var(--glass-shadow)] backdrop-blur-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[var(--text-secondary)] mb-1">{card.label}</p>
                <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{card.value}</p>
                {card.change != null && (
                  <p className={`mt-1 text-xs font-medium flex items-center gap-1 ${card.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={card.change >= 0 ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"} />
                    </svg>
                    {card.change >= 0 ? "+" : ""}{card.change.toFixed(1)}%
                  </p>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: cardColors[i].bg }}>
                <svg className="h-5 w-5" style={{ color: cardColors[i].line }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={cardColors[i].icon} />
                </svg>
              </div>
            </div>
            <div className="mt-2 h-10">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendSparkData}>
                    <Line type="monotone" dataKey="v" stroke={cardColors[i].line} strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Middle Row: Sales Overview + Top Products */}
      <div className="flex flex-col xl:flex-row gap-4 min-h-0 shrink-0 xl:h-[320px]">
        <div className="flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 shadow-[var(--glass-shadow)] backdrop-blur-xl flex flex-col">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Sales Overview</h3>
            <select
              className="rounded bg-[var(--bg-input)] px-2.5 py-1 text-xs text-ink border border-[var(--border-default)]"
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as any)}
            >
              <option value="today">Today</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="flex-1 min-h-0">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#247b7b" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#247b7b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" strokeOpacity={0.3} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<TrendTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#247b7b" strokeWidth={2} fill="url(#revenueGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="w-full xl:w-[35%] shrink-0 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 shadow-[var(--glass-shadow)] backdrop-blur-xl flex flex-col">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 shrink-0">Top Selling Products</h3>
          <div className="flex-1 space-y-2 overflow-y-auto min-h-0">
            {(stats?.topProducts?.length ? stats.topProducts : Array.from({ length: 5 }, (_, i) => ({
              productId: `placeholder-${i}`, name: "—", imagePath: null, unitsSold: 0, revenue: 0,
            }))).map((p, i) => (
              <div key={p.productId} className="flex items-center gap-3 rounded-lg bg-[var(--bg-overlay)] px-3 py-2">
                <span className="w-5 text-center text-xs font-bold text-[var(--text-mid)]">{i + 1}</span>
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-[var(--bg-input-ghost)] flex items-center justify-center">
                  {p.imagePath ? (
                    <img src={p.imagePath} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-[var(--text-muted)]">{p.name.charAt(0)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{p.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{p.unitsSold} units</p>
                </div>
                <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{bdMoney(p.revenue)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Quick Actions + Recent Activity + Low Stock */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 shadow-[var(--glass-shadow)] backdrop-blur-xl">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <a href="/checkout" className="flex flex-col items-center gap-1.5 rounded-lg border border-[var(--border-default)] p-3 text-xs text-[var(--text-default)] hover:border-teal/30 hover:bg-teal/5 hover:text-teal transition-all">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              New Sale
            </a>
            <a href="/inventory" className="flex flex-col items-center gap-1.5 rounded-lg border border-[var(--border-default)] p-3 text-xs text-[var(--text-default)] hover:border-teal/30 hover:bg-teal/5 hover:text-teal transition-all">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Add Product
            </a>
            <a href="#" className="flex flex-col items-center gap-1.5 rounded-lg border border-[var(--border-default)] p-3 text-xs text-[var(--text-default)] hover:border-teal/30 hover:bg-teal/5 hover:text-teal transition-all">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Add Customer
            </a>
            <a href="/sales-history" className="flex flex-col items-center gap-1.5 rounded-lg border border-[var(--border-default)] p-3 text-xs text-[var(--text-default)] hover:border-teal/30 hover:bg-teal/5 hover:text-teal transition-all">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Sales Report
            </a>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 shadow-[var(--glass-shadow)] backdrop-blur-xl">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Recent Activity</h3>
          <div className="space-y-2">
            {(stats?.recentActivity?.length ? stats.recentActivity : []).map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5">
                <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${a.type === "sale" ? "bg-teal/15 text-teal" : "bg-amber-400/15 text-amber-400"}`}>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {a.type === "sale" ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    )}
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[var(--text-default)] truncate">{a.description}</p>
                  <p className="text-[10px] text-[var(--text-tertiary)]">
                    {new Date(a.createdAt).toLocaleTimeString("en-BD", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {a.amount != null && (
                  <p className="text-xs font-medium text-[var(--text-primary)] tabular-nums shrink-0">{bdMoney(a.amount)}</p>
                )}
              </div>
            ))}
            {(!stats?.recentActivity?.length) && (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">No recent activity</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 shadow-[var(--glass-shadow)] backdrop-blur-xl">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center justify-between">
            Low Stock Alert
            {stats?.lowStock?.length ? <span className="rounded-full bg-red-400/15 px-2 py-0.5 text-[10px] font-medium text-red-400">{stats.lowStock.length}</span> : null}
          </h3>
          <div className="space-y-2">
            {(stats?.lowStock?.length ? stats.lowStock : []).map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 rounded-lg bg-[var(--bg-overlay)] px-3 py-2">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-md bg-red-400/10 flex items-center justify-center">
                  {p.imagePath ? (
                    <img src={p.imagePath} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-red-400">{p.name.charAt(0)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate">{p.name}</p>
                  <p className="text-[10px] text-[var(--text-tertiary)]">{p.sku}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-red-400 tabular-nums">{p.stockLevel}</p>
                  <div className="mt-0.5 h-1.5 w-16 overflow-hidden rounded-full bg-[var(--bg-input)]">
                    <div
                      className="h-full rounded-full bg-red-400 transition-all"
                      style={{ width: `${Math.min(100, (p.stockLevel / Math.max(p.lowStockAt, 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {(!stats?.lowStock?.length) && (
              <p className="text-xs text-emerald-400 flex items-center gap-1.5 py-4">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                All products well stocked
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer Status Bar */}
      <div className="flex items-center justify-between shrink-0 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2 text-[11px] text-[var(--text-muted)] shadow-[var(--glass-shadow)]">
        <div className="flex items-center gap-2">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <span>Backup: {heartbeat?.lastBackupAt ? new Date(heartbeat.lastBackupAt).toLocaleString() : "Never"}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${heartbeat?.sqlite === "online" ? "bg-emerald-400" : "bg-red-400"}`} />
          <span>Database: {heartbeat?.sqlite === "online" ? "Connected" : heartbeat?.sqlite ?? "checking..."}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>v2.0.3.12</span>
          {updateInfo === null ? (
            <span className="text-[10px] text-amber-400 ml-1">Checking update...</span>
          ) : updateInfo.available ? (
            <span className="text-[10px] text-amber-400 ml-1">v{updateInfo.latestVersion} available</span>
          ) : (
            <span className="text-[10px] text-emerald-400 ml-1">Up to date</span>
          )}
        </div>
      </div>
    </div>
  );
}
