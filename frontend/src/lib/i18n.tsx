"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { en } from "./messages/en";
import { vi, type Messages } from "./messages/vi";
import { zh } from "./messages/zh";

export type Locale = "vi" | "en" | "zh";

const KEY = "riverbank-locale";
const ALL: Record<Locale, Messages> = { vi, en, zh };
const HTML_LANG: Record<Locale, string> = { vi: "vi", en: "en", zh: "zh-CN" };

export const LOCALES: { id: Locale; label: string }[] = [
  { id: "vi", label: "VI" },
  { id: "en", label: "EN" },
  { id: "zh", label: "中文" },
];

type I18nValue = { locale: Locale; setLocale: (locale: Locale) => void; m: Messages };

const I18nContext = createContext<I18nValue | null>(null);

function storedLocale(): Locale {
  const raw = localStorage.getItem(KEY);
  return raw === "en" || raw === "zh" || raw === "vi" ? raw : "vi";
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("vi");

  useEffect(() => {
    const next = storedLocale();
    setLocaleState(next);
    document.documentElement.lang = HTML_LANG[next];
  }, []);

  const setLocale = (next: Locale) => {
    localStorage.setItem(KEY, next);
    document.documentElement.lang = HTML_LANG[next];
    setLocaleState(next);
  };

  const value = useMemo<I18nValue>(() => ({ locale, setLocale, m: ALL[locale] }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("LocaleProvider missing");
  return value;
}
