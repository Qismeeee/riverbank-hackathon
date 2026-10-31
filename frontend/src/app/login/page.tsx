"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { Shell } from "@/components/shell";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { errorText } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { Role } from "@/lib/types";

function destinationFor(role: Role, next: string | null): string {
  const sellerHome = "/seller";
  const lenderHome = "/lender";
  if (!next || !next.startsWith("/") || next.startsWith("//")) return role === "seller" ? sellerHome : lenderHome;
  if (role === "seller") return next === "/seller" || next.startsWith("/seller/") ? next : sellerHome;
  if (next.startsWith("/lender") || next.startsWith("/studio")) return next;
  return lenderHome;
}

const SELLER_IDS = [
  "thuha.closet",
  "minhchau.shop",
  "ducthinh.tech",
  "ngocvy.boutique",
  "maianh.fashion",
  "phucan.beauty",
  "khang.phukien",
  "tung.giadung",
  "han.store",
  "hau.mart",
] as const;
const REVIEWER_IDS = ["tran.ngoclan", "nguyen.ducminh", "le.thuthao"] as const;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { setSession } = useAuth();
  const { m } = useI18n();
  const next = params.get("next");
  const [role, setRole] = useState<Role>(next?.startsWith("/lender") || next?.startsWith("/studio") ? "underwriter" : "seller");
  const [subject, setSubject] = useState(role === "seller" ? "minhchau.shop" : "tran.ngoclan");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = await api.login(subject.trim(), role, passcode);
      setSession(session);
      router.replace(destinationFor(session.role, next));
    } catch (err) {
      setError(err instanceof ApiError ? errorText(err, m.errors, m.common.server) : m.common.loginFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell active="home">
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-2xl font-semibold text-slate-900">{m.login.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{m.login.hint}</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label={m.login.role}>
            {(
              [
                ["seller", m.login.seller],
                ["underwriter", m.login.underwriter],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`rounded-xl border px-3 py-2 text-sm ${role === value ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-200"}`}
                onClick={() => {
                  setRole(value);
                  setSubject(value === "seller" ? "minhchau.shop" : "tran.ngoclan");
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="block text-sm">
            <span className="text-slate-600">{role === "seller" ? m.login.sellerId : m.login.reviewerId}</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {role === "seller"
              ? SELLER_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    title={m.login.sellers[id]}
                    className={`rounded-full border px-3 py-1 text-xs ${subject === id ? "border-brand-500 bg-brand-50" : "border-slate-200"}`}
                    onClick={() => setSubject(id)}
                  >
                    {id}
                  </button>
                ))
              : REVIEWER_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    title={m.login.reviewers[id]}
                    className={`rounded-full border px-3 py-1 text-xs ${subject === id ? "border-brand-500 bg-brand-50" : "border-slate-200"}`}
                    onClick={() => setSubject(id)}
                  >
                    {id}
                  </button>
                ))}
          </div>
          <label className="block text-sm">
            <span className="text-slate-600">{m.login.passcode}</span>
            <input
              type="password"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error ? (
            <p className="text-sm text-rose-600" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={busy} className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {busy ? m.login.working : m.login.enter}
          </button>
        </form>
      </main>
    </Shell>
  );
}

function LoginFallback() {
  const { m } = useI18n();
  return (
    <Shell active="home">
      <main className="p-10 text-sm text-slate-500">{m.login.opening}</main>
    </Shell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
