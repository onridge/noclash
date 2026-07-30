# Design tokens — Resource Booking public page

Source: Claude Design project "Resource booking visitor screen"
(`Resource Booking - Public Page.dc.html`), saved for reference at
`design-handoff/` (gitignored — it's a prototype file, not source, and not
wired into the app). Token values below are extracted verbatim from that
file's `:root` / `.dark` CSS custom properties, the Google Fonts `<link>`,
and the Tailwind utility classes used in the markup.

This is Phase 0. Nothing here is implemented into the app yet — no
components, no pages, no dependencies were added. `tailwind.config.ts` at
the repo root holds the same values as this document in config form; see
the note at the top of that file about why it isn't wired into the Tailwind
v4 build yet.

## Fonts

| Role | Family | Weights used | Google Fonts? |
|---|---|---|---|
| Display (headings) | Source Serif 4 | 400, 500, 600 | Yes — variable font, SIL Open Font License |
| Body | Public Sans | 400, 500, 600, 700 | Yes — SIL Open Font License |
| Mono (times, dates, labels) | IBM Plex Mono | 400, 500, 600 | Yes — SIL Open Font License |

All three typefaces are on Google Fonts under the SIL Open Font License —
free for any use, no paid or per-seat license required. The design loads
them via:

```
https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap
```

Source Serif 4 is a variable font (optical size axis `opsz` 8–60); the
other two are static weight sets.

## Palette

CSS custom properties in the source, swapped by adding a `.dark` class on
the root element (not Tailwind's `dark:` variant paired with two-tone
token names — the design keys everything off `var(--token)` directly).
`tailwind.config.ts` mirrors the same values as flat `token` /
`token-dark` pairs; how dark mode actually gets toggled (CSS-variable class
swap like the source, vs. Tailwind's native `dark:` variant) is an
implementation decision for whenever this gets built, not decided here.

| Token | Role | Light | Dark |
|---|---|---|---|
| `paper` | Page background | `#F6F2E9` | `#14140F` |
| `ink` | Primary text | `#1C1A16` | `#EDE6D6` |
| `ink-muted` | Secondary text | `#756E5E` | `#9C9382` |
| `rule` | Borders / dividers | `#DDD4C0` | `#2E2B20` |
| `accent` | Primary action (Book button, selected states, links) | `#1F5C4D` | `#4FBE9E` |
| `accent-tint` | Accent background wash | `#E1EBE6` | `#16302A` |
| `signal` | Errors / booking collisions | `#B23B2E` | `#E2685A` |
| `signal-tint` | Signal background wash | `#F3E3DE` | `#3A2420` |

Not extracted as tokens: the prototype's own "Preview" state-switcher
toolbar (`bg-neutral-900`, `text-neutral-100`, `ring-emerald-400`, etc.) is
throwaway design-tool chrome for switching between demo scenarios inside
the prototype, not part of the shipped page — it uses Tailwind's default
neutral/emerald scale, not the design's palette.

### Dark mode is not a naive inversion

A literal invert (swap background/foreground lightness, keep the same hue
values) would not reproduce this dark palette. Two deliberate deviations:

- **`accent` changes hue character, not just lightness.** Light mode uses
  a dark, desaturated forest green (`#1F5C4D`). Dark mode doesn't just
  lighten that same green — it swaps to a brighter, more saturated
  mint/teal (`#4FBE9E`). A straight lightness-inversion of `#1F5C4D` would
  read muddy and low-contrast against the near-black `paper-dark`.
- **`signal` is retuned the same way.** Light mode's brick red (`#B23B2E`)
  becomes a warmer, brighter coral-red (`#E2685A`) in dark mode, not a
  lightened version of the same hex.
- **The warm undertone is preserved in both modes**, deliberately. `rule`
  goes from a warm beige-grey (`#DDD4C0`) to a warm brown-grey (`#2E2B20`)
  rather than a neutral grey — same for `ink-muted`. The "paper" feeling
  carries into dark mode instead of becoming a generic dark-UI grey.
- **The tint colors aren't alpha overlays.** `accent-tint` /
  `signal-tint` are distinct hex values per mode (e.g. pale `#E1EBE6` in
  light vs. near-black-with-a-hint-of-green `#16302A` in dark), not the
  same color with opacity applied.

## Type scale

Built on Tailwind's default scale, plus one custom size below the default
minimum:

| Class | Size | Used for |
|---|---|---|
| `text-[11px]` (custom — see `micro` in `tailwind.config.ts`) | 11px | Toolbar labels, weekday abbreviations, hour-band labels |
| `text-xs` | 12px | Host line, status labels, footer suffixes |
| `text-sm` | 14px | Secondary/muted body text, timezone legend |
| `text-base` | 16px | Day-tab date numeral |
| `text-xl` | 20px | Footer's selected-time display |
| `text-2xl` | 24px | "Booked." confirmation heading; slot time (mobile) |
| `text-3xl` | 30px | Page h1 (mobile); confirmed-booking main time |
| `text-4xl` | 36px | Page h1 (sm+) |

Numeric/time values consistently use `font-mono` with `tabular-nums`.
Headings use `font-display` (serif); everything else defaults to
`font-body` (sans).

## Spacing, radii, shadows

- **Spacing**: no custom scale — every spacing utility in the file
  (`px-4`, `py-3`, `gap-1.5`, `pb-28`, etc.) is a stock Tailwind value.
  Nothing to extract.
- **Radii**: none. No `rounded-*` class appears anywhere in the page —
  buttons, cards, and the confirmation panel all use square corners
  throughout. This reads as a deliberate part of the aesthetic (paired
  with the serif/mono type and heavy rule dividers), not an oversight.
- **Shadows**: none. No `shadow-*` class appears anywhere. Depth and
  separation come entirely from `border` width/color changes (1px rule
  dividers; `border-t-2` on the two sticky footer bars) rather than
  elevation.

## TODO

- [ ] No screenshot/GIF of the rendered prototype is attached here yet.
