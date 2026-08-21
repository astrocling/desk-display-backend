import { describe, expect, it } from "vitest";
import { mapWpblStatus } from "./status";

describe("mapWpblStatus", () => {
  it("maps finals including suffix variants", () => {
    expect(mapWpblStatus("Final")).toBe("final");
    expect(mapWpblStatus("Final - 8 innings")).toBe("final");
    expect(mapWpblStatus("Final - 6 innings - Weather Delay")).toBe("final");
  });

  it("maps not-started / upcoming to scheduled", () => {
    expect(mapWpblStatus("Not Started")).toBe("scheduled");
    expect(mapWpblStatus("Upcoming")).toBe("scheduled");
    expect(mapWpblStatus("Scheduled")).toBe("scheduled");
  });

  it("maps live variants", () => {
    expect(mapWpblStatus("Live")).toBe("live");
    expect(mapWpblStatus("In Progress")).toBe("live");
  });

  it("maps unknown to other", () => {
    expect(mapWpblStatus("Postponed")).toBe("other");
    expect(mapWpblStatus("")).toBe("other");
  });
});
