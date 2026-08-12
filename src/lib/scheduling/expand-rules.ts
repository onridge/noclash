import { shiftDate } from "./day-window";

export interface AvailabilityRule {
  weekday: number;
  startsAt: string;
  endsAt: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export interface TimeSlot {
  start: Date;
  end: Date;
}

const weekdayOf = (dateStr: string): number => {
  const jsDay = new Date(`${dateStr}T00:00:00Z`).getUTCDay();

  return (jsDay + 6) % 7;
};

const formatInTimezone = (instant: Date, timeZone: string) => {
  const dtf = Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = Object.fromEntries(
    dtf.formatToParts(instant).map((p) => [p.type, p.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
};

const tzOffsetMillies = (instant: Date, timeZone: string) => {
  const asUtc = new Date(`${formatInTimezone(instant, timeZone)}Z`).getTime();
  return asUtc - instant.getTime();
};

export const zonedTimeUtc = (
  dateStr: string,
  timeStr: string,
  timeZone: string,
) => {
  const naiveUtc = new Date(`${dateStr}T${timeStr}Z`);
  const offsetA = tzOffsetMillies(naiveUtc, timeZone);
  const offsetB = tzOffsetMillies(
    new Date(naiveUtc.getTime() - offsetA),
    timeZone,
  );
  const candidate = new Date(naiveUtc.getTime() - offsetB);

  if (formatInTimezone(candidate, timeZone) !== `${dateStr}T${timeStr}`) {
    return null;
  }

  return candidate;
};

export const expandRules = (
  rules: AvailabilityRule[],
  timeZonne: string,
  range: { from: string; to: string },
): TimeSlot[] => {
  const slots: TimeSlot[] = [];

  for (let date = range.from; date < range.to; date = shiftDate(date, 1)) {
    const weekday = weekdayOf(date);

    for (const rule of rules) {
      if (rule.weekday !== weekday) continue;
      if (rule.effectiveFrom && date < rule.effectiveFrom) continue;
      if (rule.effectiveTo && date > rule.effectiveTo) continue;

      const start = zonedTimeUtc(date, rule.startsAt, timeZonne);
      const end = zonedTimeUtc(date, rule.endsAt, timeZonne);

      if (!start || !end) continue;

      slots.push({ start, end });
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
};

export const localDateOf = (instant: Date, timeZone: string) => {
  return formatInTimezone(instant, timeZone).slice(0, 10);
};
