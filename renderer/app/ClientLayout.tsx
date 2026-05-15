"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { BackupDialog } from "@/components/BackupDialog";
import { useState, useEffect } from "react";

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        {children}
        <BackupDialogWrapper />
      </AuthProvider>
    </ThemeProvider>
  );
}

function BackupDialogWrapper() {
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    const removeListener = typeof window.api?.onCloseRequest === "function"
      ? window.api.onCloseRequest(() => {
          setShowDialog(true);
        })
      : undefined;

    return () => removeListener?.();
  }, []);

  const handleBackupComplete = async () => {
    setShowDialog(false);
    await (window as any).api.confirmClose();
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
  };

  return (
    <BackupDialog
      open={showDialog}
      onClose={handleCloseDialog}
      onBackupComplete={handleBackupComplete}
    />
  );
}