"use client";

import { MainLayout } from "@/components/MainLayout";
import { InventoryView } from "@/components/InventoryView";

export default function InventoryPage() {
  return (
    <MainLayout title="Inventory Intelligence">
      <InventoryView />
    </MainLayout>
  );
}
