import { describe, expect, it } from "vitest";
import { advanceWindowCutoff } from "./advance-window";

describe("advanceWindowCutoff", () => {
  it("adds maxAdvanceDays worth of hours to now", () => {
    const now = new Date("2026-08-10T12:00:00.000Z");

    expect(advanceWindowCutoff(60, now)).toEqual(
      new Date("2026-10-09T12:00:00.000Z"),
    );
  });

  it("returns now unchanged when maxAdvanceDays is 0", () => {
    const now = new Date("2026-08-10T12:00:00.000Z");

    expect(advanceWindowCutoff(0, now)).toEqual(now);
  });

  it("adds exactly 24 hours for a 1-day window", () => {
    const now = new Date("2026-08-10T12:00:00.000Z");

    expect(advanceWindowCutoff(1, now)).toEqual(
      new Date("2026-08-11T12:00:00.000Z"),
    );
  });

  it("is a rolling duration, not a resource-local calendar-day boundary", () => {
    // Crossing a DST transition shouldn't add or subtract an hour — this is
    // plain now + N*24h, deliberately not calendar-day-in-a-timezone math.
    const now = new Date("2026-03-01T12:00:00.000Z");

    expect(advanceWindowCutoff(10, now)).toEqual(
      new Date("2026-03-11T12:00:00.000Z"),
    );
  });
});
