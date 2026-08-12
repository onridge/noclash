import { describe, expect, it } from "vitest";
import type { TimeSlot } from "./expand-rules";
import { openSlots } from "./open-slots";

const slot = (start: string, end: string): TimeSlot => ({
  start: new Date(start),
  end: new Date(end),
});

describe("openSlots", () => {
  it("returns the slots unchanged when there are no bookings", () => {
    const slots = [slot("2026-08-10T09:00:00Z", "2026-08-10T17:00:00Z")];

    expect(openSlots(slots, [])).toEqual(slots);
  });

  it("returns an empty array when there are no slots", () => {
    const bookings = [slot("2026-08-10T09:00:00Z", "2026-08-10T10:00:00Z")];

    expect(openSlots([], bookings)).toEqual([]);
  });

  it("removes a slot fully covered by a booking", () => {
    const slots = [slot("2026-08-10T09:00:00Z", "2026-08-10T17:00:00Z")];
    const bookings = [slot("2026-08-10T09:00:00Z", "2026-08-10T17:00:00Z")];

    expect(openSlots(slots, bookings)).toEqual([]);
  });

  it("removes a slot covered by a booking that extends beyond both ends", () => {
    const slots = [slot("2026-08-10T09:00:00Z", "2026-08-10T17:00:00Z")];
    const bookings = [slot("2026-08-10T08:00:00Z", "2026-08-10T18:00:00Z")];

    expect(openSlots(slots, bookings)).toEqual([]);
  });

  it("trims the front of a slot when a booking overlaps its start", () => {
    const slots = [slot("2026-08-10T09:00:00Z", "2026-08-10T17:00:00Z")];
    const bookings = [slot("2026-08-10T09:00:00Z", "2026-08-10T11:00:00Z")];

    expect(openSlots(slots, bookings)).toEqual([
      slot("2026-08-10T11:00:00Z", "2026-08-10T17:00:00Z"),
    ]);
  });

  it("trims the back of a slot when a booking overlaps its end", () => {
    const slots = [slot("2026-08-10T09:00:00Z", "2026-08-10T17:00:00Z")];
    const bookings = [slot("2026-08-10T15:00:00Z", "2026-08-10T17:00:00Z")];

    expect(openSlots(slots, bookings)).toEqual([
      slot("2026-08-10T09:00:00Z", "2026-08-10T15:00:00Z"),
    ]);
  });

  it("splits a slot in two when a booking sits in the middle", () => {
    const slots = [slot("2026-08-10T09:00:00Z", "2026-08-10T17:00:00Z")];
    const bookings = [slot("2026-08-10T12:00:00Z", "2026-08-10T13:00:00Z")];

    expect(openSlots(slots, bookings)).toEqual([
      slot("2026-08-10T09:00:00Z", "2026-08-10T12:00:00Z"),
      slot("2026-08-10T13:00:00Z", "2026-08-10T17:00:00Z"),
    ]);
  });

  it("leaves a slot untouched when a booking only touches its boundary", () => {
    // [start, end) — a booking ending exactly at the slot's start (or
    // starting exactly at its end) does not overlap it.
    const slots = [slot("2026-08-10T09:00:00Z", "2026-08-10T17:00:00Z")];
    const bookings = [
      slot("2026-08-10T08:00:00Z", "2026-08-10T09:00:00Z"),
      slot("2026-08-10T17:00:00Z", "2026-08-10T18:00:00Z"),
    ];

    expect(openSlots(slots, bookings)).toEqual(slots);
  });

  it("leaves a slot untouched when a booking doesn't overlap it at all", () => {
    const slots = [slot("2026-08-10T09:00:00Z", "2026-08-10T17:00:00Z")];
    const bookings = [slot("2026-08-11T09:00:00Z", "2026-08-11T10:00:00Z")];

    expect(openSlots(slots, bookings)).toEqual(slots);
  });

  it("carves out multiple gaps from one slot across multiple bookings", () => {
    const slots = [slot("2026-08-10T09:00:00Z", "2026-08-10T17:00:00Z")];
    const bookings = [
      slot("2026-08-10T10:00:00Z", "2026-08-10T11:00:00Z"),
      slot("2026-08-10T14:00:00Z", "2026-08-10T15:00:00Z"),
    ];

    expect(openSlots(slots, bookings)).toEqual([
      slot("2026-08-10T09:00:00Z", "2026-08-10T10:00:00Z"),
      slot("2026-08-10T11:00:00Z", "2026-08-10T14:00:00Z"),
      slot("2026-08-10T15:00:00Z", "2026-08-10T17:00:00Z"),
    ]);
  });

  it("only affects the slot a booking actually overlaps", () => {
    const slots = [
      slot("2026-08-10T09:00:00Z", "2026-08-10T17:00:00Z"),
      slot("2026-08-11T09:00:00Z", "2026-08-11T17:00:00Z"),
    ];
    const bookings = [slot("2026-08-11T09:00:00Z", "2026-08-11T10:00:00Z")];

    expect(openSlots(slots, bookings)).toEqual([
      slot("2026-08-10T09:00:00Z", "2026-08-10T17:00:00Z"),
      slot("2026-08-11T10:00:00Z", "2026-08-11T17:00:00Z"),
    ]);
  });

  it("returns results sorted by start time regardless of input order", () => {
    const slots = [
      slot("2026-08-11T09:00:00Z", "2026-08-11T17:00:00Z"),
      slot("2026-08-10T09:00:00Z", "2026-08-10T17:00:00Z"),
    ];

    expect(openSlots(slots, [])).toEqual([
      slot("2026-08-10T09:00:00Z", "2026-08-10T17:00:00Z"),
      slot("2026-08-11T09:00:00Z", "2026-08-11T17:00:00Z"),
    ]);
  });
});
