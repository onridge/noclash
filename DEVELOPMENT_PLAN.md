# Booking App — Development Plan

## Goal

A portfolio-grade booking system that demonstrates database-enforced correctness,
timezone handling, and row-level security. Total cost: $0.

Definition of "done enough to put on a resume":
public repo, working `docker compose up`, seeded demo data, README with schema diagram
and a written explanation of the exclusion constraint, deployed link, green CI.

## Free-tier hosting notes

| Concern | Choice | Note |
|---|---|---|
| Hosting | Vercel Hobby | No card required |
| Database + Auth | Supabase free | Pauses after ~7 days inactivity |
| Keep-alive | GitHub Actions weekly cron | Pings a health endpoint so the demo isn't dead when a recruiter clicks |
| CI | GitHub Actions | Free on public repos |
| Email | Supabase built-in auth emails | Rate limited but fine for a demo; GitHub OAuth as the primary path |
| Local dev | Postgres in Docker | Burns no quota |

Free-tier limits change often — verify before relying on any of the above.

---

## Schema

```sql
create extension if not exists btree_gist;

-- resources: the thing being booked
create table resources (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  slug                text not null unique,
  timezone            text not null,              -- IANA, e.g. 'Europe/Madrid'
  slot_minutes        int  not null default 60 check (slot_minutes between 5 and 480),
  buffer_minutes      int  not null default 0 check (buffer_minutes >= 0),
  max_advance_days     int  not null default 60,
  created_at          timestamptz not null default now()
);

-- recurring weekly availability, stored as wall-clock time in the resource's tz
create table availability_rules (
  id             uuid primary key default gen_random_uuid(),
  resource_id    uuid not null references resources(id) on delete cascade,
  weekday        int  not null check (weekday between 0 and 6),   -- 0 = Monday
  starts_at      time not null,
  ends_at        time not null,
  effective_from date,
  effective_to   date,
  check (ends_at > starts_at)
);

-- one-off overrides: holidays, extended hours
create table availability_exceptions (
  id          uuid primary key default gen_random_uuid(),
  resource_id uuid not null references resources(id) on delete cascade,
  on_date     date not null,
  is_closed   boolean not null default true,
  starts_at   time,
  ends_at     time,
  unique (resource_id, on_date),
  check (is_closed or (starts_at is not null and ends_at is not null))
);

create type booking_status as enum ('confirmed', 'cancelled');

create table bookings (
  id          uuid primary key default gen_random_uuid(),
  resource_id uuid not null references resources(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  during      tstzrange not null,
  blocks      tstzrange not null,   -- `during` widened by buffer_minutes, set by trigger
  status      booking_status not null default 'confirmed',
  notes       text,
  created_at  timestamptz not null default now(),
  cancelled_at timestamptz,
  check (not isempty(during)),
  check (lower_inc(during) and not upper_inc(during))   -- [start, end)
);

-- THE centrepiece: no two live bookings for the same resource may overlap
alter table bookings
  add constraint bookings_no_overlap
  exclude using gist (resource_id with =, blocks with &&)
  where (status = 'confirmed');

-- append-only audit trail
create table booking_events (
  id         bigserial primary key,
  booking_id uuid not null references bookings(id) on delete cascade,
  event      text not null,          -- created | cancelled | rescheduled
  actor_id   uuid references auth.users(id),
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

### Why `blocks` is a separate column set by a trigger

The buffer between bookings needs the constraint to compare *widened* ranges. The obvious
move is a generated column computing `tstzrange(lower(during) - interval, upper(during) + interval)`,
but interval arithmetic on `timestamptz` is `STABLE`, not `IMMUTABLE` (it depends on the
session timezone for DST-crossing cases), so Postgres rejects it in a generated column.
A `BEFORE INSERT OR UPDATE` trigger that computes `blocks` is the correct workaround.

Write this reasoning in the README — it's exactly the kind of detail that makes an
interviewer lean in.

### Indexes

- `bookings_no_overlap` gives you the GiST index for free — no separate range index needed.
- `create index on bookings (user_id, created_at desc)` for "my bookings".
- `create index on availability_rules (resource_id, weekday)`.
- Include `EXPLAIN ANALYZE` output before/after in the README once seeded with ~200k bookings.

---

## Phases

### Phase 0 — Foundation

Repo, Next.js + TS + Tailwind, Docker Postgres, Drizzle wired up, CI running lint +
typecheck + tests on push. Nothing user-visible. Do not skip CI; adding it later never happens.

### Phase 1 — Core booking, single timezone

Resources and bookings tables, the exclusion constraint, manual slot creation, a booking
form, list of bookings. Everything in UTC for now. **Ends with an integration test that
fires two concurrent conflicting inserts and asserts exactly one succeeds with SQLSTATE
23P01.** That test is the whole project's thesis statement.

### Phase 2 — Availability rules and timezones

Weekly rules, exceptions, resource timezone. Server-side slot generation: expand rules
into concrete `timestamptz` slots, subtract existing bookings, return open slots. Handle
DST transitions explicitly and write tests for a spring-forward date (a slot at 02:30 that
doesn't exist) and an autumn-back date (an ambiguous hour).

### Phase 3 — Auth and RLS

Supabase Auth, GitHub OAuth. RLS policies: owners manage their own resources, users read
their own bookings, public read of open slots only. Test that user A gets zero rows for
user B's bookings. Cancellation flow writing to `booking_events`.

### Phase 4 — Depth and polish

Buffer trigger, reschedule (as cancel + create in one transaction), owner dashboard with
utilisation stats (`generate_series` calendar heatmap, occupancy per weekday), seed script
with realistic volume, `EXPLAIN ANALYZE` write-up, Playwright happy path, README with
schema diagram and demo GIF, deploy, keep-alive cron.

### Optional stretch

ICS calendar feed per resource, waitlist for a full slot, recurring bookings, optimistic
UI on slot selection, rate limiting on the public booking endpoint.

---

## Risks

- **Timezones will take longer than you expect.** Budget double. Do not start Phase 2
  before Phase 1's concurrency test passes.
- **Scope creep toward a SaaS product.** No payments, no teams, no notifications, no
  multi-language. The constraint story is the point.
- **Supabase pausing the free project** kills your demo link silently. Set up the
  keep-alive cron in Phase 4 and check the link monthly.
