"use client";

import { MainLayout } from "@/components/MainLayout";
import { useAuth } from "@/hooks/useAuth";
import { SalesHistoryView } from "@/components/SalesHistoryView";

export default function SalesHistoryPage() {
  const { hasCapability } = useAuth();

  if (!hasCapability("REPORTS")) {
    return (
      <MainLayout title="Sales History">
        <div className="rounded border border-[var(--border-default)] bg-[var(--bg-card)] p-5 backdrop-blur-xl">
          <p className="text-sm text-[var(--text-secondary)]">Manager or Owner access required to view sales history.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Sales History">
      <SalesHistoryView />
    </MainLayout>
  );
}
