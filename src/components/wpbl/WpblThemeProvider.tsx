"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  WPBL_THEME_STORAGE_KEY,
  applyDocumentColorScheme,
  resolveWpblColorScheme,
  systemColorScheme,
  type WpblColorScheme,
} from "@/lib/wpbl-theme";

type WpblThemeContextValue = {
  scheme: WpblColorScheme;
  setScheme: (scheme: WpblColorScheme) => void;
  toggle: () => void;
};

const WpblThemeContext = createContext<WpblThemeContextValue | null>(null);

function readStoredScheme(): string | null {
  try {
    return sessionStorage.getItem(WPBL_THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredScheme(scheme: WpblColorScheme): void {
  try {
    sessionStorage.setItem(WPBL_THEME_STORAGE_KEY, scheme);
  } catch {
    // private mode / quota — keep in-memory only
  }
}

function documentScheme(): WpblColorScheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function WpblThemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<WpblColorScheme>("light");

  useEffect(() => {
    const initial = resolveWpblColorScheme(
      readStoredScheme(),
      systemColorScheme(),
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from sessionStorage after SSR-safe default
    setSchemeState(initial);
    applyDocumentColorScheme(initial);

    return () => {
      applyDocumentColorScheme(systemColorScheme());
    };
  }, []);

  const setScheme = useCallback((next: WpblColorScheme) => {
    setSchemeState(next);
    writeStoredScheme(next);
    applyDocumentColorScheme(next);
  }, []);

  const toggle = useCallback(() => {
    const next: WpblColorScheme =
      documentScheme() === "dark" ? "light" : "dark";
    setScheme(next);
  }, [setScheme]);

  const value = useMemo(
    () => ({ scheme, setScheme, toggle }),
    [scheme, setScheme, toggle],
  );

  return (
    <WpblThemeContext.Provider value={value}>{children}</WpblThemeContext.Provider>
  );
}

export function useWpblTheme(): WpblThemeContextValue {
  const ctx = useContext(WpblThemeContext);
  if (!ctx) {
    throw new Error("useWpblTheme must be used within WpblThemeProvider");
  }
  return ctx;
}
