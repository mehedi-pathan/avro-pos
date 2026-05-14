"use client";

import { MainLayout } from "@/components/MainLayout";
import { TeamManagement } from "@/components/TeamManagement";

export default function StaffPage() {
  return (
    <MainLayout title="Team Management">
      <TeamManagement />
    </MainLayout>
  );
}
