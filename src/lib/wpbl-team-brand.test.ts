import { describe, expect, it } from "vitest";

import {
  getWpblTeamBrand,
  wpblTeamAccent,
  wpblTeamBadgeBg,
  wpblTeamLogoSrc,
  wpblTeamPrimary,
  wpblTeamPrimaryDark,
} from "./wpbl-team-brand";

describe("getWpblTeamBrand", () => {
  it("returns brand for each known abbr", () => {
    for (const abbr of ["LA", "NY", "SF", "BOS"] as const) {
      const brand = getWpblTeamBrand(abbr);
      expect(brand).not.toBeNull();
      expect(brand!.abbr).toBe(abbr);
      expect(brand!.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(brand!.primaryDark).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(brand!.logoSrc).toMatch(/^\/wpbl\//);
    }
  });

  it("returns null for unknown abbr", () => {
    expect(getWpblTeamBrand("XX")).toBeNull();
    expect(getWpblTeamBrand("")).toBeNull();
  });
});

describe("wpblTeamPrimary", () => {
  it("returns team primary for known abbrs", () => {
    expect(wpblTeamPrimary("LA")).toBe("#AF9067");
    expect(wpblTeamPrimary("NY")).toBe("#0B1F3A");
    expect(wpblTeamPrimary("SF")).toBe("#5B2A8C");
    expect(wpblTeamPrimary("BOS")).toBe("#0B6B3A");
  });

  it("returns slate fallback for unknown", () => {
    expect(wpblTeamPrimary("??")).toBe("#64748b");
  });
});

describe("wpblTeamBadgeBg", () => {
  it("uses official standings plate colors for each team", () => {
    expect(wpblTeamBadgeBg("LA")).toBe("#000000");
    expect(wpblTeamBadgeBg("SF")).toBe("#2c1747");
    expect(wpblTeamBadgeBg("NY")).toBe("#091c47");
    expect(wpblTeamBadgeBg("BOS")).toBe("#00281e");
  });

  it("falls back for unknown abbr", () => {
    expect(wpblTeamBadgeBg("??")).toBe("#64748b");
  });
});

describe("wpblTeamPrimaryDark", () => {
  it("returns visible dark-mode accent for each team", () => {
    expect(wpblTeamPrimaryDark("LA")).toBe("#C9A961");
    expect(wpblTeamPrimaryDark("NY")).toBe("#5B9BD5");
    expect(wpblTeamPrimaryDark("SF")).toBe("#FF4F00");
    expect(wpblTeamPrimaryDark("BOS")).toBe("#E8922E");
  });

  it("falls back for unknown abbr", () => {
    expect(wpblTeamPrimaryDark("??")).toBe("#64748b");
  });
});

describe("wpblTeamAccent", () => {
  it("returns CSS vars for known abbrs", () => {
    expect(wpblTeamAccent("NY")).toEqual({
      "--team-accent": "#0B1F3A",
      "--team-accent-dark": "#5B9BD5",
    });
    expect(wpblTeamAccent("SF")).toEqual({
      "--team-accent": "#5B2A8C",
      "--team-accent-dark": "#FF4F00",
    });
  });

  it("uses slate fallback for unknown abbr", () => {
    expect(wpblTeamAccent("??")).toEqual({
      "--team-accent": "#64748b",
      "--team-accent-dark": "#64748b",
    });
  });
});

describe("wpblTeamLogoSrc", () => {
  it("returns path for known and null for unknown", () => {
    expect(wpblTeamLogoSrc("SF")).toMatch(/^\/wpbl\//);
    expect(wpblTeamLogoSrc("nope")).toBeNull();
  });
});
