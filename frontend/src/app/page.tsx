"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Cpu, Landmark, Scale, Store } from "lucide-react";
import { GuestHome } from "@/components/guest-home";
import { LandingVisual } from "@/components/landing-visual";
import { Reveal } from "@/components/reveal";
import { Shell } from "@/components/shell";
import { Simulator } from "@/components/simulator";
import { useI18n } from "@/lib/i18n";

export default function HomePage() {
  const { m } = useI18n();
  return (
    <Shell tone="dark" active="home">
      <GuestHome>
      <div className="pointer-events-none fixed inset-0 grid-bg grid-bg-motion" aria-hidden="true" />
      <div
        className="pointer-events-none fixed left-1/2 top-24 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-brand-500/20 blur-3xl hero-glow lg:left-[72%] lg:translate-x-0"
        aria-hidden="true"
      />
      <main className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <section className="grid items-center gap-10 py-14 lg:grid-cols-12">
          <div className="hero-stage lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
              {m.home.kicker}
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {m.home.title1}
              <br />
              {m.home.title2}
              <br />
              <span className="bg-gradient-to-r from-brand-400 to-amber-300 bg-clip-text text-transparent">{m.home.title3}</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-400">{m.home.lead}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#thu" className="cta-impress cursor-pointer rounded-xl px-5 py-3 text-sm font-medium text-white">
                {m.home.try}
              </a>
              <Link
                href="/seller"
                className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-white/10"
              >
                {m.home.enterSeller}
              </Link>
            </div>
          </div>
          <div className="hero-visual relative lg:col-span-6">
            <div className="hero-visual-float">
              <LandingVisual alt={m.home.visualAlt} caption={m.home.projectionNote} />
            </div>
          </div>
        </section>

        <Reveal as="section" className="py-14">
          <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">{m.home.valleyTitle}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Reveal as="article" delayMs={40} className="card-lift rounded-2xl border border-white/10 bg-slate-900/70 p-7">
              <div className="text-sm font-semibold tracking-wide text-brand-300">{m.home.week0}</div>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">{m.home.week0Title}</h3>
              <p className="mt-3 text-lg leading-relaxed text-slate-200">{m.home.week0Text}</p>
            </Reveal>
            <Reveal as="article" delayMs={120} className="card-lift rounded-2xl border border-white/10 bg-slate-900/70 p-7">
              <div className="text-sm font-semibold tracking-wide text-teal-300">{m.home.later}</div>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">{m.home.laterTitle}</h3>
              <p className="mt-3 text-lg leading-relaxed text-slate-200">{m.home.laterText}</p>
            </Reveal>
            <Reveal as="article" delayMs={200} className="card-lift rounded-2xl border border-rose-500/30 bg-rose-500/10 p-7">
              <div className="text-sm font-semibold tracking-wide text-rose-300">{m.home.result}</div>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">{m.home.resultTitle}</h3>
              <p className="mt-3 text-lg leading-relaxed text-rose-50">{m.home.resultText}</p>
            </Reveal>
          </div>
        </Reveal>

        <Reveal as="section" id="thu" className="scroll-mt-20 py-14" delayMs={40}>
          <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">{m.home.simTitle}</h2>
          <p className="mt-4 max-w-3xl text-xl leading-relaxed text-slate-200">{m.home.simLead}</p>
          <div className="mt-8">
            <Simulator />
          </div>
        </Reveal>

        <Reveal as="section" className="py-14">
          <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">{m.home.screensTitle}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Reveal delayMs={40}>
              <ScreenLink href="/seller" icon={<Store className="h-5 w-5" />} kicker={m.home.sellerKicker} title={m.home.sellerTitle} text={m.home.sellerText} kickerClass="text-brand-300" />
            </Reveal>
            <Reveal delayMs={120}>
              <ScreenLink href="/lender" icon={<Landmark className="h-5 w-5" />} kicker={m.home.lenderKicker} title={m.home.lenderTitle} text={m.home.lenderText} kickerClass="text-teal-300" />
            </Reveal>
            <Reveal delayMs={200}>
              <ScreenLink href="/studio" icon={<Cpu className="h-5 w-5" />} kicker={m.home.studioKicker} title={m.home.studioTitle} text={m.home.studioText} kickerClass="text-amber-300" />
            </Reveal>
          </div>
        </Reveal>

        <Reveal as="section" className="py-14">
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-12 bg-white/5 text-base font-semibold">
              <div className="col-span-4 px-6 py-4 text-slate-200">{m.home.criteria}</div>
              <div className="col-span-4 px-6 py-4 text-slate-400">{m.home.oldWay}</div>
              <div className="col-span-4 px-6 py-4 text-brand-300">ezXRiverbank</div>
            </div>
            {m.home.compare.map(([name, oldWay, ours], index) => (
              <Reveal key={name} delayMs={index * 60} className="grid grid-cols-12 border-t border-white/5 text-base leading-relaxed sm:text-lg">
                <div className="col-span-12 px-6 py-4 font-semibold text-white sm:col-span-4">{name}</div>
                <div className="col-span-6 px-6 py-4 text-slate-300 sm:col-span-4">{oldWay}</div>
                <div className="col-span-6 bg-brand-500/10 px-6 py-4 font-medium text-brand-100 sm:col-span-4">{ours}</div>
              </Reveal>
            ))}
          </div>
        </Reveal>

        <section className="grid gap-4 py-14 lg:grid-cols-2">
          <Reveal delayMs={40} className="card-lift rounded-2xl border border-white/10 bg-slate-900/70 p-8">
            <h2 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-white">
              <Scale className="h-7 w-7 text-teal-300" />
              {m.home.lawTitle}
            </h2>
            <ul className="mt-6 space-y-4 text-lg leading-relaxed text-slate-200">
              {m.home.law.map((line) => (
                <li key={line} className="flex gap-3">
                  <span className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-teal-300" aria-hidden="true" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delayMs={140} className="card-lift rounded-2xl border border-white/10 bg-slate-900/70 p-8">
            <h2 className="text-3xl font-bold tracking-tight text-white">{m.home.accessTitle}</h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-200">{m.home.accessText}</p>
            <Link href="/login" className="mt-6 inline-flex cursor-pointer items-center gap-1 text-lg font-semibold text-brand-300 transition-colors duration-200 hover:text-brand-200">
              {m.home.login} <ArrowUpRight className="h-5 w-5" />
            </Link>
          </Reveal>
        </section>
      </main>
      </GuestHome>
    </Shell>
  );
}

function ScreenLink({
  href,
  icon,
  kicker,
  title,
  text,
  kickerClass,
}: {
  href: string;
  icon: ReactNode;
  kicker: string;
  title: string;
  text: string;
  kickerClass: string;
}) {
  return (
    <Link href={href} className="card-lift block cursor-pointer rounded-2xl border border-white/10 bg-slate-900/70 p-7 hover:border-brand-500/50">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 ${kickerClass}`}>{icon}</div>
      <div className={`mt-6 text-sm font-semibold tracking-wide ${kickerClass}`}>{kicker}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-white">{title}</div>
      <p className="mt-3 text-lg leading-relaxed text-slate-200">{text}</p>
    </Link>
  );
}
