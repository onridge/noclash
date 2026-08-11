# ADR-001: Double-booking is prevented by a database exclusion constraint, not application code

## Status

Accepted.

## Context

The one correctness property this app cannot get wrong: two confirmed bookings for
the same resource must never overlap in time. The obvious first implementation is
application-level check-then-insert — query for conflicting bookings, and if none
are found, insert the new one:

```ts
const conflicts = await db.query.bookings.findMany({ where: overlaps(resourceId, range) });
if (conflicts.length === 0) {
  await db.insert(bookings).values({ resourceId, during: range });
}
```

This is racy. Between the `SELECT` and the `INSERT` there is a window where a second
request can run the same check, see the same "no conflicts" result, and also insert.
Two users hitting "Book" within milliseconds of each other — the exact scenario a
booking app exists to prevent — can both succeed. Raising the transaction isolation
level to `SERIALIZABLE` narrows the window but doesn't close it without additional
locking (e.g. `SELECT ... FOR UPDATE` over the relevant row range), and that locking
has to be re-derived correctly by hand for every overlap query in the codebase,
forever. The correctness property would live in application code that's easy to
bypass by accident (a new code path that inserts a booking without going through the
"right" function) and hard to verify by inspection.

## Decision

Overlap prevention is enforced by Postgres itself, via an exclusion constraint on the
`bookings` table:

```sql
ALTER TABLE bookings
	ADD CONSTRAINT bookings_no_overlap
	EXCLUDE USING gist (resource_id WITH =, blocks WITH &&)
	WHERE (status = 'confirmed');
```

(`drizzle/0003_add_bookings_no_overlap_constraint.sql`)

This says, declaratively, at the storage layer: no two rows may exist where
`resource_id` is equal and `blocks` overlaps, among confirmed bookings. `EXCLUDE`
constraints are checked the same way `UNIQUE` constraints are — as part of the
row-insertion path itself, under the same locking Postgres already uses to guarantee
uniqueness — so there is no check-then-insert window for the same reason there's
never a window for a `UNIQUE` violation. Two concurrent transactions inserting
overlapping ranges cannot both commit; the database resolves the race, not the
application.

Two supporting decisions fall out of this:

- **`blocks` (the buffer-widened range) is a trigger-computed column, not a
  generated column.** The natural expression —
  `tstzrange(lower(during) - interval, upper(during) + interval)` — is rejected by
  Postgres as a generated column because interval arithmetic on `timestamptz` is
  `STABLE`, not `IMMUTABLE` (it depends on session timezone across DST
  boundaries). A `BEFORE INSERT OR UPDATE` trigger (`drizzle/0003_...sql`) computes
  it instead — still enforced at the database layer, just via a different
  mechanism than a generated column.
- **`btree_gist` (`drizzle/0000_enable_btree_gist.sql`) is a prerequisite, not
  incidental.** GiST natively supports range operators like `&&` but not the `=`
  equality check the constraint also needs for `resource_id`; `btree_gist` is what
  lets an equality column sit in the same GiST index as a range column.

This is codified as a standing rule in `CLAUDE.md`: "Do not replace this with
application logic. If a feature seems to require weakening the constraint, stop and
explain the tradeoff instead of removing it."

## Consequences

**The database can reject a valid-looking application request, and the app has to
handle that as a normal, expected outcome — not an error to paper over.**
`src/db/errors.ts` translates the two SQLSTATEs this produces into user-facing
messages:

- `23P01` (`exclusion_violation`) — the straightforward case, mapped to "That slot
  was just taken."
- `40P01` (`deadlock_detected`) — a real, observed outcome of this exact
  constraint under genuine concurrency, not a hypothetical. Two transactions
  racing to insert conflicting rows sometimes resolve as a deadlock (Postgres's
  deadlock detector aborting one side) rather than a clean exclusion-constraint
  rejection, depending on lock-acquisition timing. This was caught by CI on a real
  pull request (#14), not anticipated in advance — the concurrency test asserted
  the loser would always fail with `23P01` and failed itself when the GitHub
  Actions runner produced `40P01` instead. Both outcomes mean the same thing (the
  database, not application code, guaranteed only one booking survived), so both
  are mapped; `40P01`'s message says to retry rather than asserting the slot is
  taken, since a deadlock doesn't mean that.

**The test that matters most for this decision is a concurrency test, not a unit
test.** `src/db/bookings-exclusion.test.ts` fires two genuinely concurrent
conflicting inserts from two separate database connections via `Promise.allSettled`
(no sequential `await` between them) and asserts exactly one survives. A sequential
test — insert, then try to insert a conflict — would pass even if the underlying
mechanism were racy application-level check-then-insert; only real concurrency
exercises the property this ADR is about. The suite runs this repeatedly (5–8 times
in local verification during development) specifically to build confidence it isn't
a flake in either direction.

**Cost:** none of this is expressible in Drizzle's schema builder — no exclusion
constraints, no triggers, no `tstzrange` column type. `bookings`' schema lives
entirely as hand-written SQL migrations rather than `drizzle-kit generate` output,
and the table itself isn't declared in `src/db/schema.ts` (see the comments in
`drizzle/0002_create_bookings_table.sql` and `drizzle/0003_...sql` for why — briefly,
declaring a partial TS shadow of a raw-SQL-managed table risks drizzle-kit's
snapshot diffing trying to "fix" it on a future `generate`). Application code
queries and inserts `bookings` via raw `sql` templates
(`src/actions/bookings.ts`), not the typed query builder used for `resources`.
This is a real ergonomics cost, accepted because the alternative — asking Drizzle
to model something it doesn't support, or reimplementing the guarantee in
TypeScript — reintroduces exactly the racy check-then-insert problem this decision
exists to avoid.

## Alternatives considered

- **Advisory locks / an application-level mutex per resource.** Would close the
  race, but requires an external coordination point across app instances (a
  serverless/edge deployment has no shared in-process lock), and the overlap logic
  itself still has to be reimplemented correctly in application code behind the
  lock — it moves the risk rather than removing it.
- **Unique constraint on a rounded time-slot identifier** (e.g. one row per
  15-minute slot). Would work for fixed-grid bookings but not arbitrary-length
  ranges, and produces a different data model than "a booking has a start and an
  end" — a real design cost paid to avoid a range type.
- **`SERIALIZABLE` isolation with no additional constraint.** Prevents the specific
  read-then-write anomaly if every code path that touches bookings correctly opts
  into `SERIALIZABLE` and correctly retries on serialization failure — a
  discipline that has to hold forever, across every future contributor and every
  future code path, with no enforcement mechanism if it doesn't. An exclusion
  constraint enforces the property once, at the schema level, regardless of how
  the row got inserted.
