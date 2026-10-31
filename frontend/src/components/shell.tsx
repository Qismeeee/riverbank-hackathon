"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Cpu, Landmark, LayoutGrid, LogOut, Store } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { personName } from "@/lib/format";
import { LOCALES, useI18n } from "@/lib/i18n";
import { ToastHost } from "./toast";

const NAV = [
  { href: "/", key: "home", icon: LayoutGrid },
  { href: "/seller", key: "seller", icon: Store },
  { href: "/lender", key: "lender", icon: Landmark },
  { href: "/studio", key: "studio", icon: Cpu },
] as const;

type NavKey = (typeof NAV)[number]["key"];

function navForRole(role: "seller" | "underwriter" | null, ready: boolean): NavKey[] {
  if (!ready) return [];
  if (role === "seller") return ["seller"];
  if (role === "underwriter") return ["lender", "studio"];
  return ["home", "seller", "lender", "studio"];
}

export function Shell({
  tone = "light",
  active,
  children,
}: {
  tone?: "light" | "dark";
  active: (typeof NAV)[number]["key"];
  children: React.ReactNode;
}) {
  const { session, ready, logout } = useAuth();
  const { locale, setLocale, m } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const visible = navForRole(session?.role ?? null, ready);
  const homeHref = session?.role === "seller" ? "/seller" : session?.role === "underwriter" ? "/lender" : "/";
  const dark = tone === "dark";
  const bar = dark ? "border-white/10 bg-slate-950/80 text-slate-200" : "border-slate-200 bg-white/85 text-slate-800";
  const idle = dark ? "text-slate-400 hover:bg-white/5 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900";
  const activeClass = {
    home: "bg-white/10 font-medium text-white",
    seller: "bg-brand-50 font-medium text-brand-700",
    lender: "bg-teal-50 font-medium text-teal-700",
    studio: "bg-slate-900 font-medium text-white",
  };

  return (
    <div className={dark ? "min-h-screen bg-slate-950 text-slate-300" : "min-h-screen bg-slate-50 text-slate-700"}>
      <header className={`sticky top-0 z-40 border-b backdrop-blur ${bar}`}>
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href={homeHref} className="flex items-center gap-2 font-semibold tracking-tight">
            <Image
              src="/brand/logo-mark.jpg"
              alt="Riverbank"
              width={28}
              height={28}
              className="h-7 w-7 rounded-lg object-cover shadow-sm ring-1 ring-black/10"
              priority
            />
            <span>
              <span className="text-brand-500">ezX</span>Riverbank
            </span>
          </Link>
          <nav className="flex items-center gap-1" aria-label={m.nav.screens}>
            {NAV.filter((item) => visible.includes(item.key)).map((item) => {
              const Icon = item.icon;
              const current = active === item.key || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${current ? activeClass[item.key] : idle}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{m.nav[item.key]}</span>
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2 text-xs">
            <div className={`flex rounded-lg p-0.5 ${dark ? "bg-white/5" : "bg-slate-100"}`} role="group" aria-label={m.nav.language}>
              {LOCALES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={locale === item.id}
                  className={`cursor-pointer rounded-md px-2 py-1 text-[11px] font-semibold tracking-wide ${locale === item.id ? (dark ? "bg-white text-slate-900" : "bg-slate-900 text-white") : idle}`}
                  onClick={() => setLocale(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {session ? (
              <>
                <span className={dark ? "hidden text-slate-400 md:inline" : "hidden text-slate-500 md:inline"}>
                  {personName(session)} · {session.role === "seller" ? m.nav.sellerRole : m.nav.underwriterRole}
                </span>
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${idle}`}
                  onClick={() => {
                    logout();
                    router.push("/login");
                  }}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">{m.nav.logout}</span>
                </button>
              </>
            ) : (
              <Link href="/login" className={`rounded-lg px-3 py-1.5 text-sm ${idle}`}>
                {m.nav.login}
              </Link>
            )}
          </div>
        </div>
      </header>
      {children}
      <ToastHost />
    </div>
  );
}
