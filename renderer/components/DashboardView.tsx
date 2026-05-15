"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { bdMoney } from "@/lib/bdFormat";
import { useAuth } from "@/hooks/useAuth";
import { avroApi } from "@/lib/api";
import type { Product } from "@/lib/types";

type DashboardStats = {
  todayRevenue: number; yesterdayRevenue: number; revenueChange: number;
  todayCount: number; yesterdayCount: number; orderChange: number;
  todayExpenses: number;
  totalItemsSold: number; newCustomers: number;
  hourlyData: Array<{ hour: string; revenue: number }>;
  topProducts: Array<{ productId: string; name: string; imagePath: string | null; unitsSold: number; revenue: number }>;
  lowStock: Array<{ id: string; name: string; sku: string; stockLevel: number; lowStockAt: number; imagePath: string | null }>;
  recentActivity: Array<{ id: string; type: "sale" | "inventory" | "expense" | "other"; description: string; amount: number | null; createdAt: string }>;
};

const sparkData = [{ v: 4 },{ v: 7 },{ v: 3 },{ v: 9 },{ v: 6 },{ v: 11 },{ v: 8 },{ v: 13 },{ v: 10 },{ v: 15 },{ v: 12 },{ v: 18 },{ v: 14 },{ v: 20 },{ v: 17 },{ v: 22 },{ v: 19 },{ v: 24 },{ v: 21 },{ v: 27 },{ v: 23 },{ v: 29 },{ v: 25 },{ v: 32 }];

const quickActions = [
  { href: "/checkout", label: "New Sale", color: "#6366F1", icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" },
  { href: "/inventory", label: "Add Product", color: "#247b7b", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { href: "/customers", label: "Add Customer", color: "#e5a936", icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" },
  { action: "expense", label: "Add Expense", color: "#DC9B9B", icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" },
];

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} mins ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hrs ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function normalizeImagePath(src?: string | null) {
  if (!src) return null;
  const trimmed = src.trim();
  if (trimmed.startsWith("data:") || trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("file://")) {
    return trimmed;
  }
  if (trimmed.startsWith("/Users/") || trimmed.startsWith("/Volumes/")) {
    return `file://${trimmed.replace(/\\\\/g, "/")}`;
  }
  if (/^[A-Za-z]:\\/.test(trimmed)) {
    return `file://${trimmed.replace(/\\\\/g, "/")}`;
  }
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  return trimmed.replace(/^\.\//, "/");
}

export function DashboardView() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timeFilter, setTimeFilter] = useState<"today" | "weekly" | "monthly">("today");
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ amount: "", category: "Utilities", description: "" });
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [clock, setClock] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [notificationCount, setNotificationCount] = useState(3);
  const notificationRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("en-BD", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }));
      setDateStr(now.toLocaleDateString("en-BD", { timeZone: "Asia/Dhaka", year: "numeric", month: "short", day: "numeric" }));
    };
    tick(); const ti = setInterval(tick, 1000); return () => clearInterval(ti);
  }, []);

  const loadStats = () => { if (user) avroApi().getDashboardStats().then(setStats).catch(() => {}); };
  useEffect(() => {
    loadStats();
  }, [user]);

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length > 0) {
      avroApi().getProducts().then((products) => {
        const filtered = products.filter((p) => {
          if (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) return true;
          if (p.category?.toLowerCase().includes(q)) return true;
          if (p.brand?.toLowerCase().includes(q)) return true;
          if (p.subcategory?.name.toLowerCase().includes(q)) return true;
          if (p.subcategory?.category?.name.toLowerCase().includes(q)) return true;
          return false;
        });
        setSearchResults(filtered);
        setShowSearchResults(true);
      }).catch(() => {
        setSearchResults([]);
        setShowSearchResults(true);
      });
    } else {
      setSearchResults(null);
      setShowSearchResults(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showNotifications]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.amount || isNaN(Number(expenseForm.amount))) return;
    setSubmittingExpense(true);
    try {
      await avroApi().createExpense({
        amount: Number(expenseForm.amount),
        category: expenseForm.category,
        description: expenseForm.description,
        userId: user?.id
      });
      setShowExpenseModal(false);
      setExpenseForm({ amount: "", category: "Utilities", description: "" });
      loadStats();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingExpense(false);
    }
  };

  const areaData = useMemo(() => {
    if (!stats) return [];
    if (timeFilter === "today") return stats.hourlyData;
    const len = timeFilter === "weekly" ? 7 : 30;
    return Array.from({ length: len }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (len - 1 - i));
      return { hour: d.toLocaleDateString("en-BD", timeFilter === "weekly" ? { weekday: "short" } : { month: "short", day: "numeric" }), revenue: Math.floor(Math.random() * 8000 + 1000) };
    });
  }, [stats, timeFilter]);

  const greeting = useMemo(() => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; }, []);

  if (!user) return null;

  const cards = [
    { 
      label: "Today's Sales", 
      value: bdMoney(stats?.todayRevenue ?? 0), 
      change: stats?.revenueChange,
      color: "#247b7b", 
      bg: "var(--card-stat-1)", 
      icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
    },
    { 
      label: "Today's Expenses", 
      value: bdMoney(stats?.todayExpenses ?? 0), 
      change: null,
      color: "#f43f5e", 
      bg: "rgba(244, 63, 94, 0.1)", 
      icon: "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
    },
    { 
      label: "Total Orders", 
      value: String(stats?.todayCount ?? 0), 
      change: stats?.orderChange,
      color: "#6366F1", 
      bg: "var(--card-stat-2)", 
      icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" 
    },
    { 
      label: "Total Items Sold", 
      value: String(stats?.totalItemsSold ?? 0), 
      change: null,
      color: "#e5a936", 
      bg: "var(--card-stat-3)", 
      icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" 
    },
    { 
      label: "New Customers", 
      value: String(stats?.newCustomers ?? 0), 
      change: null,
      color: "#b66b4d", 
      bg: "var(--card-stat-4)", 
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" 
    },
  ];

  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 shadow-xl text-xs">
        <p className="text-[var(--text-muted)] mb-0.5">{label}</p>
        <p className="font-bold text-[var(--text-primary)]">{bdMoney(payload[0].value)}</p>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1 scrollable">
      {/* Header Row */}
      <div className="flex items-start justify-between shrink-0 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Dashboard</h1>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{greeting}, {user.displayName}! Here&apos;s what&apos;s happening with your store today.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search Bar — full inventory */}
          <div className="hidden lg:flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-muted)] w-[min(340px,28vw)] focus-within:border-teal/50 relative">
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search inventory (name, SKU, category…)" className="flex-1 bg-transparent outline-none text-[var(--text-primary)]" />
            <kbd className="rounded bg-[var(--bg-input)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)] border border-[var(--border-default)]">⌘K</kbd>
            {showSearchResults && searchResults && (
              <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xl z-50 max-h-80 overflow-y-auto">
                {searchResults.length > 0 ? (
                  searchResults.slice(0, 8).map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--bg-overlay)] cursor-pointer border-b border-[var(--border-default)] last:border-0" onClick={() => { window.location.href = `/inventory`; setSearchQuery(""); setShowSearchResults(false); }}>
                      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-input-ghost)] flex items-center justify-center">
                        {normalizeImagePath(p.imagePath) ? <img src={normalizeImagePath(p.imagePath)!} alt={p.name} className="h-full w-full object-cover" /> : <span className="text-xs font-bold text-[var(--text-muted)]">{p.name.charAt(0)}</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-medium text-[var(--text-primary)] truncate">{p.name}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">SKU: {p.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[12px] font-bold text-[var(--text-primary)]">{bdMoney(p.price)}</p>
                        <p className={`text-[10px] font-medium ${p.stockLevel > 0 ? "text-emerald-400" : "text-red-400"}`}>Stock: {p.stockLevel}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-4 text-center text-[11px] text-[var(--text-muted)]">No products found</div>
                )}
              </div>
            )}
          </div>
          {/* Date Picker */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-xs cursor-pointer hover:border-[var(--accent-primary)]/30 transition-all" onClick={() => dateInputRef.current?.showPicker()}>
            <svg className="h-3.5 w-3.5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <input ref={dateInputRef} type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent outline-none text-[var(--text-primary)] font-medium cursor-pointer pointer-events-none" />
          </div>
          <div className="hidden sm:flex items-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-xs">
            <svg className="h-3.5 w-3.5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="font-mono tabular-nums font-medium text-[var(--text-primary)]">{clock}</span>
          </div>
          {/* Notifications */}
          <div className="relative" ref={notificationRef}>
            <button className="relative rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all" onClick={() => setShowNotifications(!showNotifications)}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              {notificationCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">{notificationCount}</span>}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-xl z-50">
                <div className="border-b border-[var(--border-default)] px-3 py-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Notifications</h3>
                  <button className="text-[10px] text-[var(--accent-primary)] hover:underline" onClick={() => { setNotificationCount(0); setShowNotifications(false); }}>Clear all</button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  <div className="px-3 py-2 border-b border-[var(--border-default)] text-[11px]">
                    <p className="font-medium text-[var(--text-primary)]">Low Stock Alert</p>
                    <p className="text-[var(--text-secondary)]">3 items below minimum threshold</p>
                  </div>
                  <div className="px-3 py-2 border-b border-[var(--border-default)] text-[11px]">
                    <p className="font-medium text-[var(--text-primary)]">System Update</p>
                    <p className="text-[var(--text-secondary)]">New version available: 2.0.4</p>
                  </div>
                  <div className="px-3 py-2 text-[11px]">
                    <p className="font-medium text-[var(--text-primary)]">Backup Complete</p>
                    <p className="text-[var(--text-secondary)]">Cloud backup synced successfully</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── 4 Stat Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 shrink-0">
        {cards.map((card) => (
          <div key={card.label} className="relative overflow-hidden rounded-2xl border border-[var(--glass-border)] p-4" style={{ background: "var(--bg-card)" }}>
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: card.bg }}>
                <svg className="h-5 w-5" style={{ color: card.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={card.icon} /></svg>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-[var(--text-secondary)]">{card.label}</p>
                <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums tracking-tight">{card.value}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              {card.change != null ? (
                <p className={`text-[11px] font-medium flex items-center gap-1 ${card.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d={card.change >= 0 ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"} /></svg>
                  {card.change >= 0 ? "+" : ""}{card.change.toFixed(1)}% <span className="text-[var(--text-muted)] font-normal">vs yesterday</span>
                </p>
              ) : <span />}
              <div className="h-8 w-20">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sparkData}><Line type="monotone" dataKey="v" stroke={card.color} strokeWidth={1.5} dot={false} /></LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Sales Overview + Top Products ─── */}
      <div className="flex flex-col xl:flex-row gap-3 shrink-0 xl:h-[340px]">
        {/* Sales Chart */}
        <div className="flex-1 rounded-2xl border border-[var(--glass-border)] p-5 flex flex-col" style={{ background: "var(--bg-card)" }}>
          <div className="flex items-center justify-between mb-1 shrink-0">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Sales Overview</h3>
            <select className="rounded-lg bg-[var(--bg-input)] px-2.5 py-1 text-xs text-[var(--text-primary)] border border-[var(--border-default)] cursor-pointer" value={timeFilter} onChange={(e) => setTimeFilter(e.target.value as any)}>
              <option value="today">Today</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="mb-3 shrink-0">
            <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums tracking-tight">{bdMoney(stats?.todayRevenue ?? 0)}</p>
            <p className="text-[11px] text-[var(--text-tertiary)]">Total Sales</p>
          </div>
          <div className="flex-1 min-h-0">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" strokeOpacity={0.3} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#6366F1" strokeWidth={2} fill="url(#revGrad)" dot={false} activeDot={{ r: 5, fill: "#6366F1", stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="w-full xl:w-[35%] shrink-0 rounded-2xl border border-[var(--glass-border)] p-5 flex flex-col" style={{ background: "var(--bg-card)" }}>
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Top Selling Products</h3>
            <a href="/sales-history" className="text-[11px] text-[var(--accent-primary)] hover:underline">View all</a>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto min-h-0 scrollable">
            {(stats?.topProducts?.length ? stats.topProducts : Array.from({ length: 5 }, (_, i) => ({ productId: `p-${i}`, name: "—", imagePath: null, unitsSold: 0, revenue: 0 }))).map((p, i) => (
              <div key={p.productId} className="flex items-center gap-3 rounded-xl bg-[var(--bg-overlay)] px-3 py-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}>{i + 1}</span>
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-input-ghost)] flex items-center justify-center">
                  {normalizeImagePath(p.imagePath) ? <img src={normalizeImagePath(p.imagePath)!} alt={p.name} className="h-full w-full object-cover" /> : <span className="text-xs font-bold text-[var(--text-muted)]">{p.name.charAt(0)}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{p.name}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{p.unitsSold} sold</p>
                </div>
                <p className="text-[13px] font-bold text-emerald-400 tabular-nums">{bdMoney(p.revenue)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Bottom Row: Quick Actions + Recent Activity + Low Stock ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0 pb-1">
        {/* Quick Actions */}
        <div className="rounded-2xl border border-[var(--glass-border)] p-5" style={{ background: "var(--bg-card)" }}>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((a) => {
              const inner = (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110" style={{ background: `${a.color}15` }}>
                    <svg className="h-5 w-5" style={{ color: a.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={a.icon} /></svg>
                  </div>
                  <span className="font-medium">{a.label}</span>
                </>
              );
              const className = "group flex flex-col items-center gap-2 rounded-xl border border-[var(--border-default)] p-4 text-xs text-[var(--text-default)] transition-all hover:border-[var(--accent-primary)]/30 hover:bg-[var(--bg-card-hover)]";
              
              if (a.href) {
                return <a key={a.label} href={a.href} className={className}>{inner}</a>;
              }
              return (
                <button 
                  key={a.label} 
                  className={className} 
                  onClick={() => {
                    if (a.action === "expense") setShowExpenseModal(true);
                  }}
                >
                  {inner}
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl border border-[var(--glass-border)] p-5" style={{ background: "var(--bg-card)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Recent Activity</h3>
            <a href="/sales-history" className="text-[11px] text-[var(--accent-primary)] hover:underline">View all</a>
          </div>
          <div className="space-y-3">
            {(stats?.recentActivity?.length ? stats.recentActivity.slice(0, 4) : []).map((a) => (
              <div key={a.id} className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${a.type === "sale" ? "bg-emerald-500/15 text-emerald-400" : a.type === "expense" ? "bg-red-500/15 text-red-400" : a.type === "inventory" ? "bg-amber-400/15 text-amber-400" : "bg-blue-400/15 text-blue-400"}`}>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {a.type === "sale" ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> : 
                     a.type === "expense" ? <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /> :
                     <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />}
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] text-[var(--text-default)] truncate">{a.description}</p>
                  <p className="text-[10px] text-[var(--text-tertiary)]">{relativeTime(a.createdAt)}</p>
                </div>
                {a.amount != null && <p className={`text-[12px] font-semibold tabular-nums shrink-0 ${a.type === "expense" ? "text-red-400" : "text-emerald-400"}`}>{a.type === "expense" ? "-" : ""}{bdMoney(a.amount)}</p>}
              </div>
            ))}
            {(!stats?.recentActivity?.length) && <p className="text-xs text-[var(--text-muted)] text-center py-6">No recent activity</p>}
          </div>
          {(stats?.recentActivity?.length ?? 0) > 0 && (
            <a href="/sales-history" className="mt-3 block text-[11px] font-medium text-[var(--accent-primary)] hover:underline">View all activity</a>
          )}
        </div>

        {/* Low Stock Alert */}
        <div className="rounded-2xl border border-[var(--glass-border)] p-5" style={{ background: "var(--bg-card)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Low Stock Alert</h3>
            <a href="/inventory" className="text-[11px] text-[var(--accent-primary)] hover:underline">View all</a>
          </div>
          <div className="space-y-3">
            {(stats?.lowStock?.length ? stats.lowStock.slice(0, 4) : []).map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-red-400/10 flex items-center justify-center">
                  {normalizeImagePath(p.imagePath) ? <img src={normalizeImagePath(p.imagePath)!} alt={p.name} className="h-full w-full object-cover" /> : <span className="text-xs font-bold text-red-400">{p.name.charAt(0)}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{p.name}</p>
                </div>
                <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-400 tabular-nums">Stock: {p.stockLevel}</span>
              </div>
            ))}
            {(!stats?.lowStock?.length) && (
              <p className="text-xs text-emerald-400 flex items-center gap-1.5 py-6 justify-center">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                All products well stocked
              </p>
            )}
          </div>
        </div>
      </div>

      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border-default)] shadow-2xl overflow-hidden" style={{ background: "var(--bg-app)" }}>
            <div className="flex items-center justify-between border-b border-[var(--border-default)] p-4" style={{ background: "var(--bg-card)" }}>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Log Expense</h2>
              <button onClick={() => setShowExpenseModal(false)} className="rounded-lg p-1 hover:bg-[var(--bg-overlay)] text-[var(--text-muted)]">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleCreateExpense} className="p-4 flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Amount (৳)</label>
                <input type="number" required min="0" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none" placeholder="0.00" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Category</label>
                <select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none cursor-pointer">
                  <option value="Utilities">Utilities</option>
                  <option value="Rent">Rent</option>
                  <option value="Snacks">Snacks</option>
                  <option value="Inventory">Inventory</option>
                  <option value="Others">Others</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">Description (Optional)</label>
                <input type="text" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none" placeholder="What was this for?" />
              </div>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setShowExpenseModal(false)} className="flex-1 rounded-xl border border-[var(--border-default)] py-2 text-sm font-medium hover:bg-[var(--bg-card)]">Cancel</button>
                <button type="submit" disabled={submittingExpense} className="flex-1 rounded-xl bg-[var(--accent-primary)] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                  {submittingExpense ? "Saving..." : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
