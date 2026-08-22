import { describe, expect, it } from "vitest";

import { brandedSubdomainRewrite } from "@/lib/branded-subdomain";

describe("brandedSubdomainRewrite", () => {
  it("rewrites branded roots to app paths", () => {
    expect(brandedSubdomainRewrite("wpbl.theclingans.com", "/")).toBe("/wpbl");
    expect(brandedSubdomainRewrite("radar.theclingans.com", "/")).toBe(
      "/radar",
    );
  });

  it("rewrites root icon fallbacks to brand icons", () => {
    expect(
      brandedSubdomainRewrite("wpbl.theclingans.com", "/favicon.ico"),
    ).toBe("/wpbl/icon");
    expect(
      brandedSubdomainRewrite("wpbl.theclingans.com", "/apple-touch-icon.png"),
    ).toBe("/wpbl/apple-icon");
    expect(
      brandedSubdomainRewrite("radar.theclingans.com", "/favicon.ico"),
    ).toBe("/radar/icon");
    expect(
      brandedSubdomainRewrite("radar.theclingans.com", "/apple-icon"),
    ).toBe("/radar/apple-icon");
  });

  it("leaves unrelated hosts and paths alone", () => {
    expect(brandedSubdomainRewrite("example.com", "/")).toBeNull();
    expect(
      brandedSubdomainRewrite("wpbl.theclingans.com", "/api/wpbl"),
    ).toBeNull();
  });
});
