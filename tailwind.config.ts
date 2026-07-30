import type { Config } from "tailwindcss";

// Design tokens extracted from the "Resource Booking - Public Page" handoff
// (design-handoff/, gitignored — reference only). See docs/DESIGN.md for
// the full palette table, type scale, and dark-mode notes.
//
// NOT WIRED INTO THE BUILD. This project runs Tailwind v4, which reads
// theme tokens from `@theme` in src/app/globals.css, not from this file —
// a .ts config isn't picked up automatically. This file exists purely as
// the requested token-extraction artifact. Wiring it in later needs either
// an `@config "../tailwind.config.ts";` directive in globals.css, or
// porting these values into an `@theme` block directly — an implementation
// decision left for when this actually gets built (not Phase 0).
export default {
  content: [],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Background / text. "-dark" is the value under .dark — see
        // docs/DESIGN.md for why these aren't naive inversions.
        paper: "#F6F2E9",
        "paper-dark": "#14140F",
        ink: "#1C1A16",
        "ink-dark": "#EDE6D6",
        "ink-muted": "#756E5E",
        "ink-muted-dark": "#9C9382",
        rule: "#DDD4C0",
        "rule-dark": "#2E2B20",

        // Primary action / accent.
        accent: "#1F5C4D",
        "accent-dark": "#4FBE9E",
        "accent-tint": "#E1EBE6",
        "accent-tint-dark": "#16302A",

        // Errors / collisions.
        signal: "#B23B2E",
        "signal-dark": "#E2685A",
        "signal-tint": "#F3E3DE",
        "signal-tint-dark": "#3A2420",
      },
      fontFamily: {
        display: ['"Source Serif 4"', "serif"],
        body: ['"Public Sans"', "sans-serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
      fontSize: {
        // Below Tailwind's default xs (12px). Used for the smallest
        // uppercase micro-labels (weekday abbreviations, hour-band labels).
        micro: ["11px", { lineHeight: "1.3" }],
      },
      // No borderRadius or boxShadow extensions: the design uses square
      // corners and border-only separation throughout. See docs/DESIGN.md.
    },
  },
} satisfies Config;
