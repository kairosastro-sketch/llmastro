"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { translations, type Locale, type TranslationKey } from "./translations";

// ──────────────────────────────────────────────────────────
// Theme + Language context (combined)
// ──────────────────────────────────────────────────────────
type Theme = "dark" | "light";

interface AppContextValue {
  locale:    Locale;
  setLocale: (l: Locale) => void;
  theme:     Theme;
  setTheme:  (t: Theme) => void;
  t:         (key: TranslationKey) => string;
}

const AppContext = createContext<AppContextValue>({
  locale:    "fr",
  setLocale: () => {},
  theme:     "dark",
  setTheme:  () => {},
  t:         (k) => k,
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fr");
  const [theme,  setThemeState]  = useState<Theme>("dark");

  // Persist + apply on mount
  useEffect(() => {
    const savedLocale = (localStorage.getItem("astro_locale") as Locale) ?? "fr";
    const savedTheme  = (localStorage.getItem("astro_theme")  as Theme)  ?? "dark";
    setLocaleState(savedLocale);
    setThemeState(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("astro_locale", l);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("astro_theme", t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => translations[locale][key] ?? translations["fr"][key] ?? key,
    [locale],
  );

  return (
    <AppContext.Provider value={{ locale, setLocale, theme, setTheme, t }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}

// Shorthand hooks
export function useT() {
  return useContext(AppContext).t;
}

export function useTheme() {
  const { theme, setTheme } = useContext(AppContext);
  return { theme, setTheme, isDark: theme === "dark" };
}
