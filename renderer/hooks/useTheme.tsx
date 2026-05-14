"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, type PropsWithChildren } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const useThemeStore = create<{ theme: Theme; setTheme: (t: Theme) => void }>()(
  persist(
    (set) => ({ theme: "dark" as Theme, setTheme: (theme) => set({ theme }) }),
    { name: "avro-pos-theme" }
  )
);

export function ThemeProvider({ children }: PropsWithChildren) {
  const { theme, setTheme } = useThemeStore();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      toggle: () => setTheme(theme === "dark" ? "light" : "dark"),
      setTheme
    }),
    [theme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}
