"use client";

import { useEffect, type ReactNode } from "react";

import { applyDocumentColorScheme } from "@/lib/wpbl-theme";

/** WPBL is dark-only — lock document scheme while board routes are mounted. */
export function WpblThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyDocumentColorScheme("dark");

    return () => {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "";
    };
  }, []);

  return <>{children}</>;
}
