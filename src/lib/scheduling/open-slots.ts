import { TimeSlot } from "./expand-rules";

const subtract = (range: TimeSlot, booking: TimeSlot) => {
  const noOverlap =
    booking.end.getTime() <= range.start.getTime() ||
    booking.start.getTime() >= range.end.getTime();

  if (noOverlap) return [range];

  const result = [];

  if (booking.start.getTime() > range.start.getTime()) {
    result.push({ start: range.start, end: booking.start });
  }

  if (booking.end.getTime() < range.end.getTime()) {
    result.push({ start: booking.end, end: range.end });
  }

  return result;
};

export const openSlots = (slots: TimeSlot[], bookings: TimeSlot[]) => {
  let open = slots;

  for (const booking of bookings) {
    open = open.flatMap((range) => subtract(range, booking));
  }

  return open.sort((a, b) => a.start.getTime() - b.start.getTime());
};
