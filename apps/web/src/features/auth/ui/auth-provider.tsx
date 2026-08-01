"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { authFetch, type ClientSession, readCsrfToken } from "./auth-api";

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  readonly status: AuthStatus;
  readonly session: ClientSession | null;
  refresh(): Promise<ClientSession | null>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
let refreshInFlight: Promise<ClientSession | null> | null = null;

export function AuthProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const [session, setSession] = useState<ClientSession | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const refresh = useCallback(async () => {
    const csrfToken = readCsrfToken();
    if (!csrfToken) {
      setSession(null);
      setStatus("anonymous");
      return null;
    }
    refreshInFlight ??= authFetch<ClientSession>("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "x-csrf-token": csrfToken },
    })
      .then((nextSession) => {
        setSession(nextSession);
        setStatus("authenticated");
        return nextSession;
      })
      .catch(() => {
        setSession(null);
        setStatus("anonymous");
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
    return refreshInFlight;
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(task);
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      refresh,
      async signOut() {
        const csrfToken = readCsrfToken();
        if (csrfToken) {
          await authFetch<void>("/api/v1/auth/logout", {
            method: "POST",
            headers: { "x-csrf-token": csrfToken },
          });
        }
        setSession(null);
        setStatus("anonymous");
      },
    }),
    [refresh, session, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
