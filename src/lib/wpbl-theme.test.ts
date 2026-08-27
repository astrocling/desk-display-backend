import { describe, expect, it } from "vitest";

import {
  WPBL_THEME_INIT_SCRIPT,
  isWpblColorScheme,
  parseWpblColorScheme,
  resolveWpblColorScheme,
  systemColorScheme,
} from "./wpbl-theme";

describe("wpbl-theme", () => {
  it("accepts only light and dark", () => {
    expect(isWpblColorScheme("light")).toBe(true);
    expect(isWpblColorScheme("dark")).toBe(true);
    expect(isWpblColorScheme("system")).toBe(false);
    expect(isWpblColorScheme(null)).toBe(false);
  });

  it("forces dark chrome on WPBL and radar routes", () => {
    expect(WPBL_THEME_INIT_SCRIPT).toContain('p==="/wpbl"');
    expect(WPBL_THEME_INIT_SCRIPT).toContain('p.indexOf("/wpbl/")===0');
    expect(WPBL_THEME_INIT_SCRIPT).toContain('p==="/radar"');
    expect(WPBL_THEME_INIT_SCRIPT).toContain('p.indexOf("/radar/")===0');
    expect(WPBL_THEME_INIT_SCRIPT).toContain('colorScheme="dark"');
  });

  it("parses stored session values", () => {
    expect(parseWpblColorScheme("dark")).toBe("dark");
    expect(parseWpblColorScheme("light")).toBe("light");
    expect(parseWpblColorScheme("")).toBeNull();
    expect(parseWpblColorScheme(null)).toBeNull();
  });

  it("resolves stored preference over system", () => {
    expect(resolveWpblColorScheme("light", "dark")).toBe("light");
    expect(resolveWpblColorScheme("dark", "light")).toBe("dark");
    expect(resolveWpblColorScheme(null, "dark")).toBe("dark");
    expect(resolveWpblColorScheme("nope", "light")).toBe("light");
  });

  it("maps media matches to scheme", () => {
    expect(systemColorScheme({ matches: true })).toBe("dark");
    expect(systemColorScheme({ matches: false })).toBe("light");
  });
});
