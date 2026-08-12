import { describe, expect, it } from "vitest";
import { applyExceptions, type AvailabilityException } from "./apply-exceptions";
import type { TimeSlot } from "./expand-rules";

const slot = (start: string, end: string): TimeSlot => ({
  start: new Date(start),
  end: new Date(end),
});

const closed = (onDate: string): AvailabilityException => ({
  onDate,
  isClosed: true,
  startsAt: null,
  endsAt: null,
});

const override = (
  onDate: string,
  startsAt: string,
  endsAt: string,
): AvailabilityException => ({
  onDate,
  isClosed: false,
  startsAt,
  endsAt,
});

describe("applyExceptions", () => {
  it("returns the slots unchanged when there are no exceptions", () => {
    const slots = [slot("2026-08-10T13:00:00.000Z", "2026-08-10T21:00:00.000Z")];

    expect(applyExceptions(slots, [], "America/New_York")).toEqual(slots);
  });

  it("removes every slot on a closed date", () => {
    const slots = [
      slot("2026-08-10T13:00:00.000Z", "2026-08-10T21:00:00.000Z"),
      slot("2026-08-11T13:00:00.000Z", "2026-08-11T21:00:00.000Z"),
    ];

    const result = applyExceptions(slots, [closed("2026-08-10")], "America/New_York");

    expect(result).toEqual([
      slot("2026-08-11T13:00:00.000Z", "2026-08-11T21:00:00.000Z"),
    ]);
  });

  it("removes all slots on a closed date even when multiple rules matched that day", () => {
    const slots = [
      slot("2026-08-10T13:00:00.000Z", "2026-08-10T16:00:00.000Z"),
      slot("2026-08-10T18:00:00.000Z", "2026-08-10T21:00:00.000Z"),
    ];

    expect(applyExceptions(slots, [closed("2026-08-10")], "America/New_York")).toEqual([]);
  });

  it("replaces a day's rule-generated hours with the exception's override hours", () => {
    const slots = [slot("2026-08-11T13:00:00.000Z", "2026-08-11T21:00:00.000Z")];
    const exceptions = [override("2026-08-11", "10:00:00", "14:00:00")];

    expect(applyExceptions(slots, exceptions, "America/New_York")).toEqual([
      slot("2026-08-11T14:00:00.000Z", "2026-08-11T18:00:00.000Z"),
    ]);
  });

  it("extends availability on a date with no matching rule slot at all", () => {
    // 2026-08-16 is a Sunday with no rule-generated slot in the input —
    // the exception opens the resource anyway (a one-off special day).
    const slots = [slot("2026-08-10T13:00:00.000Z", "2026-08-10T21:00:00.000Z")];
    const exceptions = [override("2026-08-16", "12:00:00", "15:00:00")];

    expect(applyExceptions(slots, exceptions, "America/New_York")).toEqual([
      slot("2026-08-10T13:00:00.000Z", "2026-08-10T21:00:00.000Z"),
      slot("2026-08-16T16:00:00.000Z", "2026-08-16T19:00:00.000Z"),
    ]);
  });

  it("leaves dates without a matching exception untouched", () => {
    const slots = [
      slot("2026-08-10T13:00:00.000Z", "2026-08-10T21:00:00.000Z"),
      slot("2026-08-11T13:00:00.000Z", "2026-08-11T21:00:00.000Z"),
    ];
    const exceptions = [closed("2026-08-17")]; // unrelated date

    expect(applyExceptions(slots, exceptions, "America/New_York")).toEqual(slots);
  });

  it("applies multiple exceptions on different dates independently", () => {
    const slots = [
      slot("2026-08-10T13:00:00.000Z", "2026-08-10T21:00:00.000Z"),
      slot("2026-08-11T13:00:00.000Z", "2026-08-11T21:00:00.000Z"),
    ];
    const exceptions = [
      closed("2026-08-10"),
      override("2026-08-11", "10:00:00", "14:00:00"),
    ];

    expect(applyExceptions(slots, exceptions, "America/New_York")).toEqual([
      slot("2026-08-11T14:00:00.000Z", "2026-08-11T18:00:00.000Z"),
    ]);
  });

  it("returns results sorted by start time", () => {
    const slots = [
      slot("2026-08-11T13:00:00.000Z", "2026-08-11T21:00:00.000Z"),
      slot("2026-08-10T13:00:00.000Z", "2026-08-10T21:00:00.000Z"),
    ];

    expect(applyExceptions(slots, [], "America/New_York")).toEqual([
      slot("2026-08-10T13:00:00.000Z", "2026-08-10T21:00:00.000Z"),
      slot("2026-08-11T13:00:00.000Z", "2026-08-11T21:00:00.000Z"),
    ]);
  });

  it("skips an override whose hours fall in a spring-forward DST gap instead of adding a bad slot", () => {
    // 2026-03-08 is the US spring-forward Sunday — 02:30 doesn't exist.
    const slots: TimeSlot[] = [];
    const exceptions = [override("2026-03-08", "02:30:00", "03:30:00")];

    expect(applyExceptions(slots, exceptions, "America/New_York")).toEqual([]);
  });
});
