import { describe, expect, it } from "vitest";
import { slugify } from "./slugify";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Rehearsal Room B")).toBe("rehearsal-room-b");
  });

  it("strips punctuation and collapses separators", () => {
    expect(slugify("Café — Room #2!!")).toBe("caf-room-2");
    expect(slugify("  Multiple   Spaces  ")).toBe("multiple-spaces");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("-Room-")).toBe("room");
  });
});
