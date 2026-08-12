import { localDateOf, TimeSlot, zonedTimeUtc } from "./expand-rules";

export interface AvailabilityException {
  onDate: string;
  isClosed: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

export const applyExceptions = (
  slots: TimeSlot[],
  exceptions: AvailabilityException[],
  timeZone: string,
) => {
  const exceptionsDates = new Set(exceptions.map((e) => e.onDate));
  const kept = slots.filter(
    (s) => !exceptionsDates.has(localDateOf(s.start, timeZone)),
  );

  const overrides = [];

  for (const exception of exceptions) {
    if (exception.isClosed) continue;

    const start = zonedTimeUtc(exception.onDate, exception.startsAt!, timeZone);
    const end = zonedTimeUtc(exception.onDate, exception.endsAt!, timeZone);

    if (!start || !end) continue;

    overrides.push({ start, end });
  }

  return [...kept, ...overrides].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
};
