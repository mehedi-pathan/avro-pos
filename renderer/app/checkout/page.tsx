"use client";

import { MainLayout } from "@/components/MainLayout";
import { CheckoutView } from "@/components/CheckoutView";

export default function CheckoutPage() {
  return (
    <MainLayout title="Checkout">
      <CheckoutView />
    </MainLayout>
  );
}
