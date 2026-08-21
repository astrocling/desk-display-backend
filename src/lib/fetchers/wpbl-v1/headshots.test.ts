import { describe, expect, it, beforeEach } from "vitest";
import {
  acfPlainValue,
  clearWpblHeadshotCache,
  extractHeadshotUrlFromAcf,
  normalizeHeadshotUrl,
  normalizePlayerNameKey,
  resolvePlayerHeadshot,
} from "./headshots";

describe("headshot helpers", () => {
  beforeEach(() => {
    clearWpblHeadshotCache();
  });

  it("extracts img src from ACF formatted HTML", () => {
    const url = extractHeadshotUrlFromAcf({
      simple_value_formatted:
        '<img src="https://i0.wp.com/www.womensprobaseballleague.com/wp-content/uploads/2026/08/los-angeles-mo-ne-davis.webp?fit=300%2C300&amp;quality=80&amp;ssl=1" />',
      value_formatted: 7114,
      value: "7114",
    });
    expect(url).toContain("los-angeles-mo-ne-davis.webp");
    expect(url).toContain("w=160");
  });

  it("reads plain ACF string values", () => {
    expect(acfPlainValue({ value: "abc123", value_formatted: "abc123" })).toBe(
      "abc123",
    );
    expect(acfPlainValue("")).toBe("");
    expect(acfPlainValue(null)).toBe("");
  });

  it("normalizes player name keys across accents and punctuation", () => {
    expect(normalizePlayerNameKey("Mo'ne Davis")).toBe("monedavis");
    expect(normalizePlayerNameKey("Maïka Dumais")).toBe("maikadumais");
    expect(normalizePlayerNameKey("Maria José Valenzuela")).toBe(
      "mariajosevalenzuela",
    );
  });

  it("prefers roster URL, then stats id, then name", () => {
    const map = new Map<string, string>([
      ["pid1", "https://example.com/by-id.jpg"],
      ["name:janedoe", "https://example.com/by-name.jpg"],
    ]);
    expect(
      resolvePlayerHeadshot({
        playerId: "pid1",
        name: "Jane Doe",
        rosterHeadshotUrl: "https://example.com/roster.jpg",
        headshotMap: map,
      }),
    ).toBe("https://example.com/roster.jpg");
    expect(
      resolvePlayerHeadshot({
        playerId: "pid1",
        name: "Jane Doe",
        headshotMap: map,
      }),
    ).toBe("https://example.com/by-id.jpg");
    expect(
      resolvePlayerHeadshot({
        playerId: "missing",
        name: "Jane Doe",
        headshotMap: map,
      }),
    ).toBe("https://example.com/by-name.jpg");
  });

  it("leaves non-CDN urls unchanged when normalizing", () => {
    expect(normalizeHeadshotUrl("https://cdn.example.com/a.webp")).toBe(
      "https://cdn.example.com/a.webp",
    );
  });
});
