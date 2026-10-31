"use client";

import { useRef, useState } from "react";

export function HoldButton({ label, disabled, onHold }: { label: string; disabled?: boolean; onHold: () => void }) {
  const [progress, setProgress] = useState(0);
  const timer = useRef<number | null>(null);
  const start = useRef(0);

  function clear() {
    if (timer.current != null) window.clearInterval(timer.current);
    timer.current = null;
    setProgress(0);
  }

  function begin() {
    if (disabled) return;
    start.current = performance.now();
    timer.current = window.setInterval(() => {
      const next = Math.min(1, (performance.now() - start.current) / 900);
      setProgress(next);
      if (next >= 1) {
        clear();
        onHold();
      }
    }, 30);
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={begin}
      onPointerUp={clear}
      onPointerLeave={clear}
      className="relative w-full cursor-pointer overflow-hidden rounded-xl bg-teal-600 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="absolute inset-y-0 left-0 bg-teal-800/50" style={{ width: `${progress * 100}%` }} />
      <span className="relative">{label}</span>
    </button>
  );
}
