import lt from "./lt.json";
import en from "./en.json";

export type Locale = "lt" | "en";

export const dictionaries = { lt, en } as const;
export type Dictionary = (typeof dictionaries)["lt"];
export type TranslationKey = keyof Dictionary;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? lt;
}

export function resolveLocale(value: string | undefined): Locale {
  return value === "en" ? "en" : "lt";
}
