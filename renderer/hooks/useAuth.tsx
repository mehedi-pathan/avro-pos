"use client";

import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { avroApi } from "@/lib/api";
import { capabilityMap, type AuthUser, type Capability, type LoginResult, type Role } from "@/lib/types";

type AuthContextValue = {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  canAccess: (roles: Role[]) => boolean;
  hasCapability: (capability: Capability) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const useSessionStore = create<{
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
}>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user })
    }),
    { name: "avro-pos-session" }
  )
);

export function AuthProvider({ children }: PropsWithChildren) {
  const { user, setUser } = useSessionStore();

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login: async (username, password) => {
        const result = await avroApi().login(username, password);
        if (result.ok) {
          setUser(result.user);
        }
        return result;
      },
      logout: () => setUser(null),
      canAccess: (roles) => Boolean(user && roles.includes(user.role)),
      hasCapability: (capability) => Boolean(user && capabilityMap[user.role].includes(capability))
    }),
    [setUser, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}

export function useRequireRole(allowedRoles: Role[]) {
  const auth = useAuth();
  return {
    ...auth,
    allowed: auth.canAccess(allowedRoles)
  };
}
