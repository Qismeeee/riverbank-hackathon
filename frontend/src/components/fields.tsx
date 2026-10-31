import type { ReactNode } from "react";

export function fieldClass(tone: "brand" | "teal" | "dark" = "brand"): string {
  const focus =
    tone === "teal"
      ? "border-slate-200 bg-white text-slate-900 focus:border-teal-500 focus:ring-teal-100"
      : tone === "dark"
        ? "border-white/15 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:ring-violet-500/30"
        : "border-slate-200 bg-white text-slate-900 focus:border-brand-400 focus:ring-brand-100";
  return `mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm shadow-sm transition duration-200 focus:outline-none focus:ring-4 ${focus}`;
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  tone = "light",
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  tone?: "light" | "dark";
}) {
  const labelColor = tone === "dark" ? "text-slate-100" : "text-slate-800";
  const hintColor = tone === "dark" ? "text-slate-400" : "text-slate-500";
  return (
    <div>
      <label htmlFor={htmlFor} className={`block text-sm font-medium ${labelColor}`}>
        {label}
      </label>
      {hint ? <p className={`mt-0.5 text-xs ${hintColor}`}>{hint}</p> : null}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
