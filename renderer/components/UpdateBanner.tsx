"use client";

import { useEffect, useState } from "react";
import { avroApi } from "@/lib/api";

export function UpdateBanner() {
  const [update, setUpdate] = useState<{
    latestVersion: string;
    releaseUrl: string;
    releaseNotes: string;
    downloadUrl: string;
  } | null>(null);

  useEffect(() => {
    avroApi().checkForUpdate().then((info) => {
      if (info?.available) setUpdate(info);
    }).catch(() => {});
  }, []);

  if (!update) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2 text-xs">
      <div className="flex items-center gap-2 text-[var(--text-primary)]">
        <svg className="h-4 w-4 text-[var(--accent-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span>
          Update <span className="font-semibold text-[var(--accent-primary)]">v{update.latestVersion}</span> available
          &mdash; you&apos;re on v{update.releaseNotes ? "." : ""}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {update.releaseNotes && (
          <span className="max-w-[240px] truncate text-[var(--text-muted)]" title={update.releaseNotes}>
            {update.releaseNotes}
          </span>
        )}
        <a
          href={update.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded bg-[var(--accent-primary)] px-2.5 py-1 font-medium text-white transition-opacity hover:opacity-80"
        >
          Download
        </a>
        <button
          className="rounded border border-[var(--border-default)] px-2 py-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
          onClick={() => setUpdate(null)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
