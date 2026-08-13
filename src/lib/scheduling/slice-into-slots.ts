import { TimeSlot } from "./expand-rules";

export const sliceIntoSlots = (windows: TimeSlot[], slotMinutes: number) => {
  const slotMs = slotMinutes * 60_000;
  const slots = [];

  for (const window of windows) {
    let start = window.start.getTime();
    const windowEnd = window.end.getTime();

    while (start + slotMs <= windowEnd) {
      const end = start + slotMs;
      slots.push({ start: new Date(start), end: new Date(end) });
      start = end;
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
};
