import { describe, expect, it } from "vitest";

import {
  getWpblTeamBrand,
  wpblTeamAccent,
  wpblTeamBadgeBg,
  wpblTeamBadgeRing,
  wpblTeamLogoSrc,
  wpblTeamPrimary,
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
  it("uses a dark neutral plate for colored marks so they are not drowned", () => {
    expect(wpblTeamBadgeBg("NY")).toBe("#12171E");
    expect(wpblTeamBadgeBg("SF")).toBe("#12171E");
    expect(wpblTeamBadgeBg("BOS")).toBe("#12171E");
  });

  it("uses the gold primary plate for LA so the dark charcoal mark reads", () => {
    expect(wpblTeamBadgeBg("LA")).toBe("#AF9067");
  });

  it("falls back for unknown abbr", () => {
    expect(wpblTeamBadgeBg("??")).toBe("#64748b");
  });
});

describe("wpblTeamBadgeRing", () => {
  it("rings dark plates with the readable team color", () => {
    expect(wpblTeamBadgeRing("NY")).toBe("#3C6FA8");
    expect(wpblTeamBadgeRing("SF")).toBe("#8B5FC4");
    expect(wpblTeamBadgeRing("BOS")).toBe("#1FA05A");
  });

  it("skips a ring when the plate is already brand-colored", () => {
    expect(wpblTeamBadgeRing("LA")).toBeNull();
  });

  it("returns null for unknown abbr", () => {
    expect(wpblTeamBadgeRing("??")).toBeNull();
  });
});

describe("wpblTeamAccent", () => {
  it("returns CSS vars for known abbrs", () => {
    expect(wpblTeamAccent("NY")).toEqual({
      "--team-accent": "#0B1F3A",
      "--team-accent-dark": "#3C6FA8",
    });
    expect(wpblTeamAccent("SF")).toEqual({
      "--team-accent": "#5B2A8C",
      "--team-accent-dark": "#8B5FC4",
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
