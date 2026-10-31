"use client";

import { useEffect, useState } from "react";

type Toast = { id: number; text: string; tone: "ok" | "err" | "warn" };

const listeners = new Set<(toast: Toast) => void>();

export function toast(text: string, tone: Toast["tone"] = "ok") {
  listeners.forEach((listener) => listener({ id: Date.now() + Math.random(), text, tone }));
}

export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (item: Toast) => {
      setItems((current) => [...current, item].slice(-3));
      window.setTimeout(() => setItems((current) => current.filter((toast) => toast.id !== item.id)), 3200);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const tones = {
    ok: "bg-emerald-600 text-white",
    err: "bg-rose-600 text-white",
    warn: "bg-amber-500 text-slate-950",
  };

  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={`fade-up pointer-events-auto rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ${tones[item.tone]}`}>
          {item.text}
        </div>
      ))}
    </div>
  );
}
