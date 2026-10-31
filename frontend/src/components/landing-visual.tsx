"use client";

import { useEffect, useRef, useState } from "react";

type LandingVisualProps = {
  alt: string;
  caption: string;
};

/**
 * Layered mark so each piece can motion independently:
 * zero line → bars (stagger) → river ribbon → $ / wordmark.
 * River comes from the locked v3 extract so shape stays exact.
 * Animations start when the figure enters the viewport (.mark-play).
 */
export function LandingVisual({ alt, caption }: LandingVisualProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPlay(true);
      return;
    }
    let startTimer: number | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        // Beat so the mark is on-screen before pieces move (hero often mounts off to the side).
        startTimer = window.setTimeout(() => setPlay(true), 320);
        io.disconnect();
      },
      { threshold: 0.45, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(node);
    return () => {
      io.disconnect();
      if (startTimer) window.clearTimeout(startTimer);
    };
  }, []);

  const zero = 199;
  const barW = 20.5;
  const slots = [89, 121, 153, 185.4, 217.4, 249.4, 281, 311.4] as const;

  const up: { i: number; h: number }[] = [
    { i: 0, h: 89 },
    { i: 1, h: 56 },
    { i: 2, h: 29 },
    { i: 7, h: 45 },
  ];
  const down: { i: number; h: number }[] = [
    { i: 3, h: 25 },
    { i: 4, h: 37 },
    { i: 5, h: 44 },
    { i: 6, h: 27 },
  ];

  return (
    <figure
      ref={ref}
      className={`overflow-hidden rounded-3xl border border-white/10 bg-[#0B1220] shadow-[0_0_0_1px_rgba(249,115,22,0.12)] ${play ? "mark-play" : ""}`}
      aria-label={alt}
    >
      <div className="landing-mark relative aspect-square w-full">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 420" role="img">
          <title>{alt}</title>

          <line
            className="mark-zero"
            x1="72"
            y1={zero}
            x2="348"
            y2={zero}
            stroke="#64748B"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {up.map((bar, n) => (
            <rect
              key={`up-${bar.i}`}
              className="mark-bar-up"
              style={{ animationDelay: play ? `${120 + n * 110}ms` : undefined }}
              x={slots[bar.i]}
              y={zero - bar.h}
              width={barW}
              height={bar.h}
              rx="3"
              fill="#64748B"
            />
          ))}

          {down.map((bar, n) => (
            <rect
              key={`down-${bar.i}`}
              className="mark-bar-down"
              style={{ animationDelay: play ? `${280 + n * 110}ms` : undefined }}
              x={slots[bar.i]}
              y={zero}
              width={barW}
              height={bar.h}
              rx="3"
              fill="#FB7185"
            />
          ))}
        </svg>

        {/* Exact S-ribbon (+ $) from v3 */}
        <img
          className="mark-river pointer-events-none absolute inset-0 h-full w-full object-contain"
          src="/brand/river-ribbon.png"
          alt=""
          aria-hidden="true"
        />

        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 420 420" aria-hidden="true">
          <text
            className="mark-word"
            x="210"
            y="358"
            textAnchor="middle"
            fontSize="34"
            fontWeight="600"
            fontFamily="IBM Plex Sans, Arial, sans-serif"
            letterSpacing="-0.6"
          >
            <tspan fill="#F8FAFC">River</tspan>
            <tspan fill="#4ADE80">bank</tspan>
          </text>
        </svg>
      </div>
      <figcaption className="border-t border-white/10 px-5 py-3 text-xs text-slate-400">{caption}</figcaption>
    </figure>
  );
}
