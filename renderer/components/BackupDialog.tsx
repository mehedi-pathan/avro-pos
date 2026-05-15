"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { avroApi } from "@/lib/api";

interface BackupDialogProps {
  open: boolean;
  onClose: () => void;
  onBackupComplete: () => void;
}

export function BackupDialog({ open, onClose, onBackupComplete }: BackupDialogProps) {
  const [backingUp, setBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState("");
  const [backupResult, setBackupResult] = useState<{
    localBackup?: { success: boolean; path: string };
    driveBackup?: { success: boolean; message: string };
  } | null>(null);

  const handleBackup = async () => {
    setBackingUp(true);
    setBackupProgress("Creating local backup...");
    try {
      const result = await avroApi().backupOnClose();
      setBackupResult(result);
      setBackupProgress("Backup complete!");
      
      // Wait a moment to show the success message
      setTimeout(() => {
        onBackupComplete();
      }, 1500);
    } catch (error) {
      setBackupProgress(`Backup failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      setTimeout(() => {
        setBackingUp(false);
        setBackupProgress("");
      }, 2000);
    }
  };

  const handleSkipBackup = () => {
    onBackupComplete();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-md rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-2xl backdrop-blur-xl">
              {!backingUp && !backupResult ? (
                <>
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Backup Before Closing?</h2>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      Would you like to backup your data before closing the application? This will create a local backup and attempt to sync to Google Drive if configured.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleBackup}
                      className="flex-1 rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-ink hover:bg-teal/90 transition-all"
                    >
                      Backup & Close
                    </button>
                    <button
                      onClick={handleSkipBackup}
                      className="flex-1 rounded-lg border border-[var(--border-light)] px-4 py-2.5 text-sm text-[var(--text-default)] hover:bg-[var(--bg-card-hover)] transition-all"
                    >
                      Skip Backup
                    </button>
                    <button
                      onClick={onClose}
                      className="rounded-lg border border-[var(--border-light)] px-4 py-2.5 text-sm text-[var(--text-default)] hover:bg-[var(--bg-card-hover)] transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : backingUp ? (
                <div className="text-center py-8">
                  <div className="mb-4 flex justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal border-t-transparent" />
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">{backupProgress}</p>
                </div>
              ) : backupResult ? (
                <div className="text-center py-4">
                  <div className="mb-4 flex justify-center">
                    <svg className="h-12 w-12 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">Backup Complete!</h3>
                  <div className="text-left text-sm space-y-2 mb-4">
                    <div className="flex items-center gap-2">
                      <span className={backupResult.localBackup?.success ? "text-emerald-500" : "text-red-500"}>
                        {backupResult.localBackup?.success ? "✓" : "✗"}
                      </span>
                      <span className="text-[var(--text-secondary)]">
                        Local backup: {backupResult.localBackup?.success ? "Success" : "Failed"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={backupResult.driveBackup?.success ? "text-emerald-500" : "text-amber-500"}>
                        {backupResult.driveBackup?.success ? "✓" : "⚠"}
                      </span>
                      <span className="text-[var(--text-secondary)]">
                        Google Drive: {backupResult.driveBackup?.message}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)]">Closing application...</p>
                </div>
              ):null}
            </div>
          </motion.div>
        </>
      ) }       
    </AnimatePresence>
  );
}