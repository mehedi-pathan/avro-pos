"use client";

import { useEffect, useState, useMemo } from "react";
import { avroApi } from "@/lib/api";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { motion } from "framer-motion";
import type { Expense } from "@/lib/types";

function bdMoney(amount: number) {
  return new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", minimumFractionDigits: 2 }).format(amount);
}

export function ReportsView() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      try {
        const [analyticsData, expensesData] = await Promise.all([
          avroApi().getSalesAnalytics(),
          avroApi().listExpenses()
        ]);
        if (mounted) {
          setAnalytics(analyticsData);
          setExpenses(expensesData);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchData();
    return () => { mounted = false; };
  }, []);

  const chartData = useMemo(() => {
    if (!analytics) return [];
    return analytics.dailyLabels.map((label: string, index: number) => ({
      date: label,
      revenue: analytics.dailyValues[index],
      expense: analytics.dailyExpenses[index]
    }));
  }, [analytics]);

  const netIncome30d = analytics ? analytics.revenue30d - analytics.expenses30d : 0;
  const netIncomeToday = analytics ? analytics.todayRevenue - analytics.todayExpenses : 0;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-default)] border-t-[var(--accent-primary)]"></div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3 shadow-xl text-xs">
        <p className="text-[var(--text-muted)] mb-1 font-medium">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center justify-between gap-4 py-0.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-[var(--text-secondary)] capitalize">{p.name}</span>
            </div>
            <span className="font-bold text-[var(--text-primary)]">{bdMoney(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1 scrollable">
      {/* Header */}
      <div className="flex items-start justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Business Reports</h1>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">Financial overview, sales analytics, and expense tracking.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 shrink-0">
        <div className="rounded-2xl border border-[var(--glass-border)] p-5 flex flex-col justify-between" style={{ background: "var(--card-stat-1)" }}>
          <div className="flex items-center justify-between mb-4 text-black-100">
            <h3 className="text-sm font-semibold">30d Revenue</h3>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums tracking-tight">{bdMoney(analytics?.revenue30d ?? 0)}</p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Today: {bdMoney(analytics?.todayRevenue ?? 0)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--glass-border)] p-5 flex flex-col justify-between" style={{ background: "var(--card-stat-4)" }}>
          <div className="flex items-center justify-between mb-4 text-black-400">
            <h3 className="text-sm font-semibold">30d Expenses</h3>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-black-100 tabular-nums tracking-tight">{bdMoney(analytics?.expenses30d ?? 0)}</p>
            <p className="text-[11px] text-black-100 mt-0.5">Today: {bdMoney(analytics?.todayExpenses ?? 0)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--glass-border)] p-5 flex flex-col justify-between bg-[var(--bg-card)] relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-indigo-500 to-purple-500" />
          <div className="relative z-10 flex items-center justify-between mb-4 text-[var(--text-secondary)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">30d Net Income</h3>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
          <div className="relative z-10">
            <p className={`text-2xl font-bold tabular-nums tracking-tight ${netIncome30d >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {bdMoney(netIncome30d)}
            </p>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">Today: <span className={netIncomeToday >= 0 ? "text-emerald-500" : "text-red-500"}>{bdMoney(netIncomeToday)}</span></p>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--glass-border)] p-5 flex flex-col justify-between bg-[var(--bg-card)]">
          <div className="flex items-center justify-between mb-4 text-[var(--text-secondary)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">30d Sales Count</h3>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums tracking-tight">{analytics?.totalSales30d ?? 0}</p>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">Today: {analytics?.todayCount ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 shrink-0 xl:h-[360px]">
        
        {/* Revenue vs Expenses Area Chart */}
        <div className="xl:col-span-2 rounded-2xl border border-[var(--glass-border)] p-5 flex flex-col bg-[var(--bg-card)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 shrink-0">Cash Flow (Last 30 Days)</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" />
                <XAxis dataKey="date" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} dy={10} minTickGap={20} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} dx={-10} tickFormatter={(v) => `৳${v >= 1000 ? (v/1000).toFixed(1)+'k' : v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="expense" name="Expenses" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="rounded-2xl border border-[var(--glass-border)] p-5 flex flex-col bg-[var(--bg-card)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 shrink-0">Top Performing Products</h3>
          <div className="flex-1 min-h-0 overflow-y-auto scrollable pr-2 space-y-3">
            {(analytics?.topProducts?.length ? analytics.topProducts : []).map((p: any, idx: number) => (
              <div key={idx} className="flex flex-col gap-1.5 p-3 rounded-xl border border-[var(--border-default)] hover:bg-[var(--bg-overlay)] transition-colors">
                <div className="flex items-start justify-between">
                  <p className="text-[12px] font-medium text-[var(--text-primary)] truncate flex-1 pr-2">{p.name}</p>
                  <span className="text-[12px] font-bold text-[var(--accent-primary)] tabular-nums shrink-0">{bdMoney(p.total)}</span>
                </div>
                <div className="w-full bg-[var(--bg-input)] rounded-full h-1.5">
                  <div className="bg-[var(--accent-primary)] h-1.5 rounded-full" style={{ width: `${Math.max(10, (p.total / (analytics?.topProducts[0]?.total || 1)) * 100)}%` }}></div>
                </div>
                <p className="text-[10px] text-[var(--text-tertiary)]">{p.count} units sold</p>
              </div>
            ))}
            {(!analytics?.topProducts?.length) && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <p className="text-xs text-[var(--text-muted)]">No sales data yet</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Bottom Row: Recent Expenses List */}
      <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-card)] p-5 flex flex-col min-h-[300px]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 shrink-0">Recent Expenses</h3>
        <div className="overflow-x-auto flex-1 scrollable">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[var(--bg-overlay)] text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
              <tr>
                <th className="px-4 py-2 font-medium rounded-l-lg">Date</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium">Logged By</th>
                <th className="px-4 py-2 font-medium text-right rounded-r-lg">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)] text-[var(--text-primary)] text-[12px]">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">No expenses recorded yet.</td>
                </tr>
              ) : (
                expenses.slice(0, 15).map((e) => (
                  <tr key={e.id} className="hover:bg-[var(--bg-overlay)] transition-colors">
                    <td className="px-4 py-3">{new Date(e.date).toLocaleDateString("en-BD", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md bg-[var(--border-default)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                        {e.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] truncate max-w-[200px]">{e.description || "—"}</td>
                    <td className="px-4 py-3 text-[var(--text-tertiary)]">{e.user?.displayName || "System"}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-400 tabular-nums">{bdMoney(e.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
