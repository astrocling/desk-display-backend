import { describe, expect, it } from "vitest";

import { formatWpblPosition } from "./wpbl-position";

describe("formatWpblPosition", () => {
  it("uppercases boxscore-style positions", () => {
    expect(formatWpblPosition("cf")).toBe("CF");
    expect(formatWpblPosition("2b")).toBe("2B");
    expect(formatWpblPosition("dh/1b")).toBe("DH/1B");
    expect(formatWpblPosition("p")).toBe("P");
  });

  it("uppercases roster labels and trims", () => {
    expect(formatWpblPosition("P/Ut.")).toBe("P/UT.");
    expect(formatWpblPosition(" Inf. ")).toBe("INF.");
    expect(formatWpblPosition("CF")).toBe("CF");
  });

  it("returns null for empty values", () => {
    expect(formatWpblPosition(null)).toBeNull();
    expect(formatWpblPosition(undefined)).toBeNull();
    expect(formatWpblPosition("")).toBeNull();
    expect(formatWpblPosition("   ")).toBeNull();
  });
});
