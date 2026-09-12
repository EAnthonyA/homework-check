"use client";

import { createContext, useContext, type ReactNode } from "react";
import { getDictionary, type Dictionary, type Locale, type TranslationKey } from "./index";

type TFunc = (key: TranslationKey) => string;

interface I18nContextValue {
  locale: Locale;
  t: TFunc;
  dict: Dictionary;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const dict = getDictionary(locale);
  const t: TFunc = (key) => dict[key] ?? String(key);
  return <I18nContext.Provider value={{ locale, t, dict }}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used inside I18nProvider");
  return ctx;
}
