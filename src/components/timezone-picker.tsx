"use client";

import { useState } from "react";

const ALL_TIMEZONES = Intl.supportedValuesOf("timeZone");

const tzLabel = (tz: string) => {
  return tz.replace(/_/g, " ").replace("/", " – ");
};

const tzMeta = (tz: string): { offset: string; time: string } => {
  const now = new Date();
  let offset = "";

  try {
    const parts = new Intl.DateTimeFormat("en-Us", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(now);
    offset = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    offset = "";
  }

  let time = "";

  try {
    time = Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    }).format(now);
  } catch {
    time = "";
  }

  return { offset, time };
};

const filterTimezone = (query: string): string[] => {
  const q = query.trim().toLowerCase();

  const list = !q
    ? ALL_TIMEZONES
    : ALL_TIMEZONES.filter((tz) =>
        tz.toLowerCase().replace("_", " ").includes(q),
      );

  return list.slice(0, 8);
};

export const TimeZonePicker = ({ name }: { name: string }) => {
  const [query, setQuery] = useState<string>("");
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const results = filterTimezone(query);

  const pick = (tz: string) => {
    setSelected(tz);
    setQuery(tzLabel(tz));
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const tz = results[activeIndex];
      if (tz) pick(tz);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative flex flex-col gap-1.5">
      <span className="text-xs text-ink-muted" id="tzLabel">
        Timezone
      </span>

      <input type="hidden" name={name} value={selected ?? ""} />
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls="tz-listbox"
        aria-labelledby="tz-label"
        autoComplete="off"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search a city or region…"
        className="border border-rule bg-transparent px-3 py-2 font-mono text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      />
      {open && (
        <ul
          id="tz-listbox"
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 z-20 max-h-60 overflow-auto border border-rule bg-paper"
        >
          {results.map((tz, i) => {
            const meta = tzMeta(tz);
            return (
              <li
                key={tz}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={() => pick(tz)}
                className={`flex items-center justify-between gap-3 px-3 py-2 cursor-pointer ${
                  i === activeIndex ? "bg-accent-tint" : "hover:bg-accent-tint"
                }`}
              >
                <span className="text-sm text-ink">{tzLabel(tz)}</span>
                <span className="font-mono text-xs text-ink-muted">
                  {meta.offset} · now {meta.time}
                </span>
              </li>
            );
          })}
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-muted">
              No matching timezone.
            </li>
          )}
        </ul>
      )}
    </div>
  );
};
