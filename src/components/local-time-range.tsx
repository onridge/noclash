"use client";

import { formatTimeInZone } from "@/lib/scheduling/day-window";
import { useSyncExternalStore } from "react";

const formatRange = (start: Date, end: Date, timeZone?: string) => {
  return `${formatTimeInZone(start, timeZone)} - ${formatTimeInZone(
    end,
    timeZone,
  )}`;
};

const emptySubscribe = () => () => {};

const useHydrated = () =>
  useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

export const LocalTimeRange = ({
  start,
  end,
  resourceTimezone,
}: {
  start: Date;
  end: Date;
  resourceTimezone: string;
}) => {
  const mounted = useHydrated();

  if (!mounted) {
    return (
      <span className="font-mono text-lg tabular-nums">
        {formatRange(start, end, resourceTimezone)}
      </span>
    );
  }

  return (
    <span className="flex flex-col">
      <span className="font-mono text-lg tabular-nums">
        {formatRange(start, end)}
      </span>
      <span className="font-mono text-xs text-ink-muted">
        {formatRange(start, end, resourceTimezone)} {resourceTimezone}
      </span>
    </span>
  );
};
