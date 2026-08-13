import { describe, expect, it } from "vitest";
import type { TimeSlot } from "./expand-rules";
import { sliceIntoSlots } from "./slice-into-slots";

const slot = (start: string, end: string): TimeSlot => ({
  start: new Date(start),
  end: new Date(end),
});

describe("sliceIntoSlots", () => {
  it("returns an empty array for no windows", () => {
    expect(sliceIntoSlots([], 60)).toEqual([]);
  });

  it("splits a window that divides evenly into contiguous slots", () => {
    const windows = [slot("2026-08-10T09:00:00.000Z", "2026-08-10T12:00:00.000Z")];

    expect(sliceIntoSlots(windows, 60)).toEqual([
      slot("2026-08-10T09:00:00.000Z", "2026-08-10T10:00:00.000Z"),
      slot("2026-08-10T10:00:00.000Z", "2026-08-10T11:00:00.000Z"),
      slot("2026-08-10T11:00:00.000Z", "2026-08-10T12:00:00.000Z"),
    ]);
  });

  it("drops the leftover remainder instead of emitting a partial slot", () => {
    // 110 minutes / 30-minute slots = 3 full slots (90 min), 20 min left over.
    const windows = [slot("2026-08-10T09:00:00.000Z", "2026-08-10T10:50:00.000Z")];

    expect(sliceIntoSlots(windows, 30)).toEqual([
      slot("2026-08-10T09:00:00.000Z", "2026-08-10T09:30:00.000Z"),
      slot("2026-08-10T09:30:00.000Z", "2026-08-10T10:00:00.000Z"),
      slot("2026-08-10T10:00:00.000Z", "2026-08-10T10:30:00.000Z"),
    ]);
  });

  it("returns no slots for a window shorter than one slot", () => {
    const windows = [slot("2026-08-10T09:00:00.000Z", "2026-08-10T09:20:00.000Z")];

    expect(sliceIntoSlots(windows, 30)).toEqual([]);
  });

  it("returns exactly one slot for a window exactly one slot long", () => {
    const windows = [slot("2026-08-10T09:00:00.000Z", "2026-08-10T09:30:00.000Z")];

    expect(sliceIntoSlots(windows, 30)).toEqual([
      slot("2026-08-10T09:00:00.000Z", "2026-08-10T09:30:00.000Z"),
    ]);
  });

  it("slices multiple windows independently and returns them sorted", () => {
    const windows = [
      slot("2026-08-11T09:00:00.000Z", "2026-08-11T10:00:00.000Z"),
      slot("2026-08-10T09:00:00.000Z", "2026-08-10T10:00:00.000Z"),
    ];

    expect(sliceIntoSlots(windows, 60)).toEqual([
      slot("2026-08-10T09:00:00.000Z", "2026-08-10T10:00:00.000Z"),
      slot("2026-08-11T09:00:00.000Z", "2026-08-11T10:00:00.000Z"),
    ]);
  });
});
