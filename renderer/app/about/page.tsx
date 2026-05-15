"use client";

import { MainLayout } from "@/components/MainLayout";
import { APP_VERSION } from "@/lib/version";

const SUPPORT_PHONE = "01622839616";
const SUPPORT_TEL = `tel:${SUPPORT_PHONE.replace(/\s/g, "")}`;

export default function AboutPage() {
  return (
    <MainLayout title="About the software">
      <div className="mx-auto flex max-w-3xl flex-col gap-5 pb-8">
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 backdrop-blur-xl">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
            <img src="/avro-logo.png" alt="Avro POS" className="h-16 w-16 shrink-0 rounded-xl shadow-lg shadow-teal/20" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Enterprise POS</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)]">Avro POS</h1>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                Local-first desktop point of sale for retail and inventory. Your data stays on-device with optional cloud backup.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 py-1 text-xs font-medium text-[var(--text-primary)]">
                <span className="text-[var(--text-muted)]">Version</span>
                <span className="tabular-nums text-teal">{APP_VERSION}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 backdrop-blur-xl">
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Design</h2>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            User interface, visual language, and experience patterns are designed by the{" "}
            <strong className="font-medium text-[var(--text-primary)]">Avro POS design team</strong>, aligned with modern
            enterprise POS workflows and accessibility-minded layouts.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 backdrop-blur-xl">
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Development</h2>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Application engineering, integrations, and releases are delivered by the{" "}
            <strong className="font-medium text-[var(--text-primary)]">Avro POS development team</strong>, built with
            Next.js, Electron, Prisma, and SQLite.
          </p>
        </div>

        <div className="rounded-xl border border-teal/25 bg-[var(--bg-card)] p-5 backdrop-blur-xl">
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">System engineer</h2>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            <strong className="font-semibold text-[var(--text-primary)]">Mehedi Pathan</strong>
            <span className="text-[var(--text-muted)]"> — </span>
            systems architecture, core implementation, and technical operations.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1.5">
              Portfolio:{" "}
              <a
                href="https://mehedipathan.online"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal/80 underline decoration-teal/30 underline-offset-2 hover:text-teal"
              >
                mehedipathan.online
              </a>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <a
                href="https://www.linkedin.com/in/mehedi-pathan/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-teal/80 underline decoration-teal/30 underline-offset-2 hover:text-teal"
                aria-label="Mehedi Pathan on LinkedIn"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                LinkedIn
              </a>
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-overlay)] px-4 py-3 text-center">
          <p className="text-[11px] leading-relaxed text-[var(--text-tertiary)]">
            Contact the support team:{" "}
            <a href={SUPPORT_TEL} className="font-medium text-[var(--text-secondary)] hover:text-teal">
              {SUPPORT_PHONE}
            </a>
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
