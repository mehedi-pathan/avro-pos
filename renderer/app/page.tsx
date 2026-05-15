"use client";

import { FormEvent, useState, useRef, useEffect } from "react";
import { avroApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { MainLayout } from "@/components/MainLayout";
import { DashboardView } from "@/components/DashboardView";
import { APP_VERSION } from "@/lib/version";

export default function HomePage() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      setTimeout(() => usernameRef.current?.focus(), 100);
    }
  }, [user]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    const result = await login(username, password);
    setIsLoading(false);
    if (!result.ok) {
      setError(result.error);
    }
  }

  return (
    <>
      {user ? (
        <MainLayout title="Dashboard">
          <DashboardView />
        </MainLayout>
      ) : (
        <main className="flex min-h-screen animate-fade-in">
          <div className="relative hidden w-1/2 overflow-hidden bg-[radial-gradient(circle_at_top_left,var(--bg-teal),transparent_34%),linear-gradient(135deg,var(--bg-app),var(--bg-card)_48%,var(--bg-app))] lg:flex lg:flex-col lg:items-center lg:justify-center">
            <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-teal/10 blur-3xl" />
            <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-teal/5 blur-3xl" />
            <div className="relative z-10 max-w-md px-12">
              <div className="mb-12 flex items-center gap-4">
                <img src="/avro-logo.png" alt="Avro POS" className="h-12 w-12 rounded-xl shadow-lg shadow-teal/25" />
                <div>
                  <h1 className="text-2xl font-bold text-[var(--text-primary)]">Avro POS</h1>
                  <p className="text-sm text-[var(--text-secondary)]">Enterprise Point of Sale</p>
                </div>
              </div>
              <h2 className="text-3xl font-bold leading-tight text-[var(--text-primary)]">
                Secure, local-first retail operations
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[var(--text-mid)]">
                Everything you need to run your business — offline-capable, privacy-first, and lightning fast.
              </p>
              <div className="mt-10 space-y-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal/20">
                    <svg className="h-4 w-4 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Works offline</p>
                    <p className="text-sm text-[var(--text-secondary)]">No internet? No problem. Full functionality locally.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal/20">
                    <svg className="h-4 w-4 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Real-time sync</p>
                    <p className="text-sm text-[var(--text-secondary)]">Google Drive backup keeps your data safe.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal/20">
                    <svg className="h-4 w-4 text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Role-based access</p>
                    <p className="text-sm text-[var(--text-secondary)]">Granular permissions for your team.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute bottom-8 left-12 z-10">
              <p className="text-xs text-white/30">Avro POS v{APP_VERSION}</p>
            </div>
          </div>

          <div className="flex w-full flex-col bg-[var(--bg-solid)] lg:w-1/2">
            <div className="flex flex-1 items-center justify-center px-6">
              <div className="w-full max-w-sm animate-slide-up">
                <div className="mb-8 lg:hidden">
                  <img src="/avro-logo.png" alt="Avro POS" className="mb-3 h-10 w-10 rounded-xl shadow-lg shadow-teal/25" />
                  <h1 className="text-2xl font-bold text-[var(--text-high)]">Avro POS</h1>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">Sign in to your account</p>
                </div>

                <div className="mb-8 hidden lg:block">
                  <h2 className="text-3xl font-bold text-[var(--text-high)]">Welcome back</h2>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">Sign in to your account to continue</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]" htmlFor="username">
                      Username
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <svg className="h-4 w-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <input
                        id="username"
                        ref={usernameRef}
                        className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] py-2.5 pl-10 pr-4 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--bg-teal)] focus:outline-none focus:ring-2 focus:ring-[var(--bg-teal)]/20 transition-all"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="username"
                        placeholder="Enter your username"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]" htmlFor="password">
                      Password
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <svg className="h-4 w-4 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <input
                        id="password"
                        className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] py-2.5 pl-10 pr-10 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--bg-teal)] focus:outline-none focus:ring-2 focus:ring-[var(--bg-teal)]/20 transition-all"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                        tabIndex={-1}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 animate-shake">
                      <svg className="h-4 w-4 shrink-0 text-[var(--color-danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-[var(--color-danger)]">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || !username || !password}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--bg-teal)] px-4 py-2.5 font-medium text-[var(--text-high)] transition-all hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[var(--bg-teal)]/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Signing in...
                      </>
                    ) : (
                      "Sign in"
                    )}
                  </button>
                </form>
              </div>
            </div>

            <div className="pb-6 text-center">
              <p className="text-xs text-[var(--text-muted)]">
                Developed by <a href="https://mehedipathan.online" target="_blank" rel="noopener noreferrer" className="text-[var(--bg-teal)] hover:underline">Mehedi Pathan</a>
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                &copy; 2023 &ndash; {new Date().getFullYear()} Avro POS v{APP_VERSION}. All rights reserved.
              </p>
            </div>
          </div>
        </main>
      )}
    </>
  );
}
