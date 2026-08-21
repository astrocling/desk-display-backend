import { describe, expect, it } from "vitest";
import {
  getWpblTeamBrand,
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

describe("wpblTeamLogoSrc", () => {
  it("returns path for known and null for unknown", () => {
    expect(wpblTeamLogoSrc("SF")).toMatch(/^\/wpbl\//);
    expect(wpblTeamLogoSrc("nope")).toBeNull();
  });
});
