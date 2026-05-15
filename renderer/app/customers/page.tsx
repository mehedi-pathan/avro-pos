"use client";

import { MainLayout } from "@/components/MainLayout";
import { CustomersView } from "@/components/CustomersView";

export default function CustomersPage() {
  return (
    <MainLayout title="Customers">
      <CustomersView />
    </MainLayout>
  );
}
