# CLAUDE.md

Project instructions for Claude Code. Read this before making changes.

## What this project is

A resource booking / scheduling app. Owners define resources (rooms, courts, tutor slots) with weekly availability rules and a timezone. Users book slots. No payments.

The technical centerpiece is that double-booking is impossible at the database level via a Postgres `EXCLUDE USING gist` constraint on a `tstzrange` column — not prevented by application-level check-then-insert, which is racy. Do not replace this with application logic. If a feature seems to require weakening the constraint, stop and explain the tradeoff instead of removing it.

## Stack

- Next.js (App Router) + TypeScript + Server Actions
- Tailwind CSS
- Postgres — Supabase hosted (free tier); local dev via Docker
- Supabase Auth (email magic link + GitHub OAuth) and Row Level Security
- Drizzle ORM for schema and queries, `drizzle-kit` for migrations
- Vitest for unit + integration tests, Playwright for one E2E happy path
- GitHub Actions for CI and for a weekly keep-alive ping

## Hard rules

1. Raw SQL for anything Drizzle can't express. Exclusion constraints, GiST indexes, extensions, RLS policies, and triggers go in hand-written migration files. Never fake them in TypeScript.
2. All timestamps are `timestamptz`. Never `timestamp` without time zone. Availability rules store wall-clock `time` plus the resource's IANA timezone string; ranges are materialised to `timestamptz` at booking time.
3. No time math in the browser for correctness-critical paths. The server computes available slots. The client only renders them.
4. Every schema change is a migration file committed to git. No changes made through the Supabase dashboard.
5. RLS is on for every table with user data, and there is a test proving user A cannot read user B's bookings.
6. Do not add dependencies without stating why in the commit message. No paid services, no service that requires a credit card.

## Commands

```bash
pnpm dev                 # dev server
pnpm db:up               # docker compose up postgres
pnpm db:generate         # drizzle-kit generate
pnpm db:migrate          # apply migrations
pnpm db:seed             # seed realistic demo data
pnpm test                # vitest (unit + integration, needs db:up)
pnpm test:e2e            # playwright
pnpm lint && pnpm typecheck
```

## Conventions

- Server Actions for mutations; route handlers only for webhooks/cron.
- Zod schema validation at every trust boundary (form input, action args, route params).
- Errors from database constraints are caught and translated into user-facing messages — a `23P01` exclusion violation becomes "That slot was just taken."
- Domain logic (slot generation, buffer math, rule expansion) lives in `lib/scheduling/` as pure functions with unit tests. Keep it out of React components.
- Commit per task, conventional commit prefixes, present tense.

## Working style for Claude Code

- One Trello card per session. Start in plan mode (`shift+tab`), agree the approach, then implement.
- Before starting any task, give the branch name first, as the first line of the response.
- `/clear` between cards so context stays clean.
- Claude explains the approach and shows guidance/snippets; the user writes the implementation code themselves. This extends to operational commands too — Docker, migrations, seeding, git (branch/commit/push/PR) — Claude tells the user the exact commands and what to expect rather than running them. Claude's own job is limited to writing the tests and verifying the implementation (typecheck/lint/tests, and checking it actually matches what was asked); verification assumes the user has already brought up anything it needs (e.g. Docker Postgres).
- Write the test first for anything in `lib/scheduling/` and for every database constraint.
- After implementing, run `pnpm lint && pnpm typecheck && pnpm test` before reporting done.
- Update `DEVELOPMENT_PLAN.md` if a decision changes; it is the source of truth for architecture, not chat history.

## Framework notes

@AGENTS.md
