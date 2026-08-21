export const WPBL_THEME_STORAGE_KEY = "wpbl-color-scheme";

export type WpblColorScheme = "light" | "dark";

export function isWpblColorScheme(value: unknown): value is WpblColorScheme {
  return value === "light" || value === "dark";
}

export function parseWpblColorScheme(raw: string | null): WpblColorScheme | null {
  return isWpblColorScheme(raw) ? raw : null;
}

export function systemColorScheme(
  media: Pick<MediaQueryList, "matches"> = {
    matches:
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches,
  },
): WpblColorScheme {
  return media.matches ? "dark" : "light";
}

export function resolveWpblColorScheme(
  stored: string | null,
  system: WpblColorScheme,
): WpblColorScheme {
  return parseWpblColorScheme(stored) ?? system;
}

export function applyDocumentColorScheme(scheme: WpblColorScheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", scheme === "dark");
  document.documentElement.style.colorScheme = scheme;
}

/** Inline script for root layout — avoids FOUC on WPBL routes. */
export const WPBL_THEME_INIT_SCRIPT = `(function(){try{var p=location.pathname;var wpbl=p==="/wpbl"||p.indexOf("/wpbl/")===0;var t=null;if(wpbl){try{t=sessionStorage.getItem(${JSON.stringify(WPBL_THEME_STORAGE_KEY)});}catch(e){}}var dark=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);document.documentElement.style.colorScheme=dark?"dark":"light";}catch(e){}})();`;
