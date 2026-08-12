import { describe, expect, it } from "vitest";
import { expandRules, type AvailabilityRule } from "./expand-rules";

const rule = (overrides: Partial<AvailabilityRule> = {}): AvailabilityRule => ({
  weekday: 0,
  startsAt: "09:00:00",
  endsAt: "17:00:00",
  effectiveFrom: null,
  effectiveTo: null,
  ...overrides,
});

describe("expandRules", () => {
  it("expands a weekday rule into a UTC slot, converted from the resource's timezone", () => {
    // 2026-08-10 is a Monday; America/New_York is UTC-4 (EDT) in August.
    const slots = expandRules(
      [rule({ weekday: 0, startsAt: "09:00:00", endsAt: "17:00:00" })],
      "America/New_York",
      { from: "2026-08-10", to: "2026-08-11" },
    );

    expect(slots).toEqual([
      { start: new Date("2026-08-10T13:00:00.000Z"), end: new Date("2026-08-10T21:00:00.000Z") },
    ]);
  });

  it("repeats a rule across every matching weekday in the range", () => {
    // Two Mondays: 2026-08-10 and 2026-08-17.
    const slots = expandRules(
      [rule({ weekday: 0 })],
      "America/New_York",
      { from: "2026-08-10", to: "2026-08-24" },
    );

    expect(slots).toEqual([
      { start: new Date("2026-08-10T13:00:00.000Z"), end: new Date("2026-08-10T21:00:00.000Z") },
      { start: new Date("2026-08-17T13:00:00.000Z"), end: new Date("2026-08-17T21:00:00.000Z") },
    ]);
  });

  it("treats the range as half-open — [from, to)", () => {
    const slots = expandRules(
      [rule({ weekday: 0 })],
      "America/New_York",
      { from: "2026-08-10", to: "2026-08-17" },
    );

    expect(slots).toHaveLength(1);
    expect(slots[0]!.start).toEqual(new Date("2026-08-10T13:00:00.000Z"));
  });

  it("excludes rules for weekdays that don't occur in the range", () => {
    const slots = expandRules(
      [rule({ weekday: 2 })], // Wednesday
      "America/New_York",
      { from: "2026-08-10", to: "2026-08-11" }, // just Monday
    );

    expect(slots).toEqual([]);
  });

  it("includes multiple rules on the same day, sorted by start time", () => {
    const slots = expandRules(
      [
        rule({ weekday: 0, startsAt: "14:00:00", endsAt: "17:00:00" }),
        rule({ weekday: 0, startsAt: "09:00:00", endsAt: "12:00:00" }),
      ],
      "America/New_York",
      { from: "2026-08-10", to: "2026-08-11" },
    );

    expect(slots).toEqual([
      { start: new Date("2026-08-10T13:00:00.000Z"), end: new Date("2026-08-10T16:00:00.000Z") },
      { start: new Date("2026-08-10T18:00:00.000Z"), end: new Date("2026-08-10T21:00:00.000Z") },
    ]);
  });

  it("excludes a rule before its effectiveFrom date", () => {
    const slots = expandRules(
      [rule({ weekday: 0, effectiveFrom: "2026-08-17" })],
      "America/New_York",
      { from: "2026-08-10", to: "2026-08-24" },
    );

    expect(slots).toEqual([
      { start: new Date("2026-08-17T13:00:00.000Z"), end: new Date("2026-08-17T21:00:00.000Z") },
    ]);
  });

  it("excludes a rule after its effectiveTo date", () => {
    const slots = expandRules(
      [rule({ weekday: 0, effectiveTo: "2026-08-10" })],
      "America/New_York",
      { from: "2026-08-10", to: "2026-08-24" },
    );

    expect(slots).toEqual([
      { start: new Date("2026-08-10T13:00:00.000Z"), end: new Date("2026-08-10T21:00:00.000Z") },
    ]);
  });

  it("returns an empty array when there are no rules", () => {
    expect(
      expandRules([], "America/New_York", { from: "2026-08-10", to: "2026-08-17" }),
    ).toEqual([]);
  });

  describe("DST transitions", () => {
    it("skips an occurrence whose start time falls in the spring-forward gap", () => {
      // 2026-03-08 is the US spring-forward Sunday: clocks jump 02:00 -> 03:00,
      // so 02:30 never happens that day.
      const slots = expandRules(
        [rule({ weekday: 6, startsAt: "02:30:00", endsAt: "03:30:00" })],
        "America/New_York",
        { from: "2026-03-08", to: "2026-03-09" },
      );

      expect(slots).toEqual([]);
    });

    it("skips an occurrence whose end time falls in the spring-forward gap, even though start is valid", () => {
      // startsAt (01:30) exists that day; endsAt (02:30) doesn't. The whole
      // occurrence must still be skipped — a half-open slot can't have a
      // valid start and no valid end.
      const slots = expandRules(
        [rule({ weekday: 6, startsAt: "01:30:00", endsAt: "02:30:00" })],
        "America/New_York",
        { from: "2026-03-08", to: "2026-03-09" },
      );

      expect(slots).toEqual([]);
    });

    it("expands the same rule normally on a Sunday without a DST transition", () => {
      // Control case: identical rule, one week earlier, no transition — proves
      // the gap above is caused by DST, not a bug that always skips 02:30.
      const slots = expandRules(
        [rule({ weekday: 6, startsAt: "02:30:00", endsAt: "03:30:00" })],
        "America/New_York",
        { from: "2026-03-01", to: "2026-03-02" },
      );

      expect(slots).toEqual([
        { start: new Date("2026-03-01T07:30:00.000Z"), end: new Date("2026-03-01T08:30:00.000Z") },
      ]);
    });

    it("resolves an ambiguous fall-back hour to a single, deterministic instant", () => {
      // 2026-11-01 is the US fall-back Sunday: 01:00-01:59 happens twice.
      // We resolve to the earlier (still-DST, UTC-4) occurrence.
      const slots = expandRules(
        [rule({ weekday: 6, startsAt: "01:30:00", endsAt: "02:00:00" })],
        "America/New_York",
        { from: "2026-11-01", to: "2026-11-02" },
      );

      expect(slots).toEqual([
        { start: new Date("2026-11-01T05:30:00.000Z"), end: new Date("2026-11-01T07:00:00.000Z") },
      ]);
    });
  });
});
