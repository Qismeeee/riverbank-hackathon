"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Role, Session } from "./types";

const KEY = "riverbank-session";

type AuthValue = {
  session: Session | null;
  ready: boolean;
  setSession: (session: Session) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

function readSession(): Session | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Session;
    if (new Date(session.expires_at).getTime() <= Date.now()) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return session;
  } catch {
    sessionStorage.removeItem(KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSessionState(readSession());
    setReady(true);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      ready,
      setSession: (next) => {
        sessionStorage.setItem(KEY, JSON.stringify(next));
        setSessionState(next);
      },
      logout: () => {
        sessionStorage.removeItem(KEY);
        setSessionState(null);
      },
    }),
    [session, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}

export function useRequireRole(role: Role, next?: string) {
  const { session, ready } = useAuth();
  const router = useRouter();
  const destination = next ?? (role === "seller" ? "/seller" : "/lender");
  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace(`/login?next=${destination}`);
      return;
    }
    if (session.role !== role) router.replace(session.role === "seller" ? "/seller" : "/lender");
  }, [ready, session, role, router, destination]);
  return { session: session?.role === role ? session : null, ready: ready && session?.role === role };
}
