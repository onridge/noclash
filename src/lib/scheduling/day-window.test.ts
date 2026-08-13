import { describe, expect, it } from "vitest";
import {
  dayWindow,
  formatDayHeading,
  formatTimeInZone,
  formatTimeUtc,
  parseDateParam,
  shiftDate,
} from "./day-window";

describe("parseDateParam", () => {
  it("returns a valid date param unchanged", () => {
    expect(parseDateParam("2026-08-10")).toBe("2026-08-10");
  });

  it("defaults to today (UTC) when missing", () => {
    const now = new Date("2026-08-10T23:30:00Z");
    expect(parseDateParam(undefined, now)).toBe("2026-08-10");
  });

  it("defaults to today (UTC) when malformed", () => {
    const now = new Date("2026-08-10T12:00:00Z");
    expect(parseDateParam("not-a-date", now)).toBe("2026-08-10");
    expect(parseDateParam("2026-8-10", now)).toBe("2026-08-10");
    expect(parseDateParam("", now)).toBe("2026-08-10");
  });
});

describe("shiftDate", () => {
  it("shifts forward within a month", () => {
    expect(shiftDate("2026-08-10", 1)).toBe("2026-08-11");
  });

  it("shifts backward within a month", () => {
    expect(shiftDate("2026-08-10", -1)).toBe("2026-08-09");
  });

  it("rolls over a month boundary", () => {
    expect(shiftDate("2026-08-31", 1)).toBe("2026-09-01");
  });

  it("rolls over a year boundary", () => {
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDate("2027-01-01", -1)).toBe("2026-12-31");
  });
});

describe("dayWindow", () => {
  it("returns the [from, to) UTC boundaries for one calendar day", () => {
    expect(dayWindow("2026-08-10")).toEqual({
      from: "2026-08-10T00:00:00Z",
      to: "2026-08-11T00:00:00Z",
    });
  });
});

describe("formatDayHeading", () => {
  it("formats a weekday, month, and day", () => {
    expect(formatDayHeading("2026-08-10")).toBe("Monday, August 10");
  });
});

describe("formatTimeUtc", () => {
  it("formats a Date as a 12-hour UTC time", () => {
    expect(formatTimeUtc(new Date("2026-08-10T10:00:00Z"))).toBe("10:00 AM");
    expect(formatTimeUtc(new Date("2026-08-10T00:00:00Z"))).toBe("12:00 AM");
    expect(formatTimeUtc(new Date("2026-08-10T13:05:00Z"))).toBe("1:05 PM");
  });
});

describe("formatTimeInZone", () => {
  it("formats a Date as a 12-hour time in an explicit UTC timezone", () => {
    expect(formatTimeInZone(new Date("2026-08-10T10:00:00Z"), "UTC")).toBe(
      "10:00 AM",
    );
    expect(formatTimeInZone(new Date("2026-08-10T00:00:00Z"), "UTC")).toBe(
      "12:00 AM",
    );
    expect(formatTimeInZone(new Date("2026-08-10T13:05:00Z"), "UTC")).toBe(
      "1:05 PM",
    );
  });

  it("formats a Date in a non-UTC IANA timezone", () => {
    // Europe/Madrid is UTC+2 in August (CEST).
    expect(
      formatTimeInZone(new Date("2026-08-10T10:00:00Z"), "Europe/Madrid"),
    ).toBe("12:00 PM");
    // America/New_York is UTC-4 in August (EDT).
    expect(
      formatTimeInZone(new Date("2026-08-10T13:00:00Z"), "America/New_York"),
    ).toBe("9:00 AM");
  });

  // No test for the no-argument case: omitting `timeZone` is JS's own,
  // already-guaranteed way of asking Intl.DateTimeFormat for the runtime's
  // local zone. Asserting that here would mean asserting this test
  // environment's own timezone, which isn't something this suite controls
  // or should depend on.
});
