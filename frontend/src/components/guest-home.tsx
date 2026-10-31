"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export function GuestHome({ children }: { children: React.ReactNode }) {
  const { session, ready } = useAuth();
  const { m } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (!ready || !session) return;
    router.replace(session.role === "seller" ? "/seller" : "/lender");
  }, [ready, session, router]);

  if (!ready || session) {
    return <p className="relative px-4 py-16 text-sm text-slate-400">{m.home.opening}</p>;
  }
  return <>{children}</>;
}
