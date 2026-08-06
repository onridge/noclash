// Pure date-window helpers for the day-view page. Everything here
// operates on plain UTC calendar days — Phase 1 is UTC-only per
// DEVELOPMENT_PLAN.md; resource-timezone-aware slot generation is
// Phase 2's job. Kept out of the page component per CLAUDE.md
// ("Domain logic ... lives in lib/scheduling/ as pure functions with
// unit tests. Keep it out of React components.").

const DATE_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Defaults to "today" in UTC when dateParam is missing or malformed —
// a bad ?date= query param should degrade gracefully, not 500.
export function parseDateParam(
  dateParam: string | undefined,
  now: Date = new Date(),
): string {
  if (dateParam && DATE_PARAM_PATTERN.test(dateParam)) {
    return dateParam;
  }
  return now.toISOString().slice(0, 10);
}

export function shiftDate(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// The [from, to) window listBookings expects for one UTC calendar day.
export function dayWindow(dateStr: string): { from: string; to: string } {
  return {
    from: `${dateStr}T00:00:00Z`,
    to: `${shiftDate(dateStr, 1)}T00:00:00Z`,
  };
}

export function formatDayHeading(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatTimeUtc(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
}
