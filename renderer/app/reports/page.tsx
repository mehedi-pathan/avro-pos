"use client";

import { MainLayout } from "@/components/MainLayout";
import { ReportsView } from "@/components/ReportsView";

export default function ReportsPage() {
  return (
    <MainLayout title="Reports">
      <ReportsView />
    </MainLayout>
  );
}
