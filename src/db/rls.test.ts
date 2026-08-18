import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { createDb } from "./client";
import { resources } from "./schema";

// This app's own Server Actions connect via DATABASE_URL as the table
// owner, which bypasses RLS entirely by default — that's fine, RLS here
// protects the REST/GraphQL/Realtime surface Supabase exposes
// automatically on every table, not this app's own trusted server code.
// So `db` below (the normal privileged connection) is only ever used to
// seed rows; every actual assertion runs through `asUser`/`asAnon`,
// which impersonate what an API caller authenticated as a specific user
// (or nobody) would actually see under RLS.
const db = createDb(process.env.TEST_DATABASE_URL!);

function validResource(overrides: Partial<typeof resources.$inferInsert> = {}) {
  return {
    ownerId: randomUUID(),
    name: "Room A",
    slug: `room-${randomUUID()}`,
    timezone: "Europe/Madrid",
    ...overrides,
  };
}

async function insertResource(ownerId: string) {
  const [row] = await db
    .insert(resources)
    .values(validResource({ ownerId }))
    .returning();
  if (!row) throw new Error("insert did not return a row");
  return row.id;
}

async function insertBooking(resourceId: string, userId: string) {
  const [row] = await db.execute<{ id: string }>(sql`
    INSERT INTO bookings (resource_id, user_id, during)
    VALUES (
      ${resourceId},
      ${userId},
      '[2026-08-10 10:00+00,2026-08-10 11:00+00)'::tstzrange
    )
    RETURNING id
  `);
  if (!row) throw new Error("insert did not return a row");
  return row.id;
}

// Runs `run` inside a transaction impersonating the `authenticated` role
// with auth.uid() resolving to `userId` — SET LOCAL scopes both to this
// transaction, which is rolled back automatically once `run` settles, so
// nothing here ever leaks into another test.
function asUser<T>(userId: string, run: (tx: postgres.TransactionSql) => Promise<T>) {
  return db.$client.begin(async (tx) => {
    await tx`SET LOCAL ROLE authenticated`;
    await tx`SELECT set_config('request.jwt.claim.sub', ${userId}, true)`;
    return run(tx);
  });
}

function asAnon<T>(run: (tx: postgres.TransactionSql) => Promise<T>) {
  return db.$client.begin(async (tx) => {
    await tx`SET LOCAL ROLE anon`;
    return run(tx);
  });
}

describe("resources RLS", () => {
  it("is publicly readable, even with no authenticated user at all", async () => {
    const ownerId = randomUUID();
    await insertResource(ownerId);

    const rows = await asAnon((tx) => tx`SELECT id FROM resources WHERE owner_id = ${ownerId}`);

    expect(rows).toHaveLength(1);
  });

  it("rejects inserting a resource owned by someone other than the caller", async () => {
    const callerId = randomUUID();
    const someoneElse = randomUUID();

    await expect(
      asUser(callerId, (tx) => tx`
        INSERT INTO resources (owner_id, name, slug, timezone)
        VALUES (${someoneElse}, 'Room', ${`room-${randomUUID()}`}, 'Europe/Madrid')
      `),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("allows inserting a resource owned by the caller themselves", async () => {
    const callerId = randomUUID();

    await expect(
      asUser(callerId, (tx) => tx`
        INSERT INTO resources (owner_id, name, slug, timezone)
        VALUES (${callerId}, 'Room', ${`room-${randomUUID()}`}, 'Europe/Madrid')
      `),
    ).resolves.toBeDefined();
  });

  it("rejects updating a resource the caller doesn't own", async () => {
    const ownerId = randomUUID();
    const someoneElse = randomUUID();
    const resourceId = await insertResource(ownerId);

    const rows = await asUser(someoneElse, (tx) => tx`
      UPDATE resources SET name = 'Renamed' WHERE id = ${resourceId} RETURNING id
    `);

    // An UPDATE whose USING clause matches no rows isn't a Postgres
    // error — it just updates zero rows. That's still full protection
    // (the name never changes), just a different shape of assertion
    // than the INSERT case above.
    expect(rows).toHaveLength(0);
  });

  it("allows the owner to update their own resource", async () => {
    const ownerId = randomUUID();
    const resourceId = await insertResource(ownerId);

    const rows = await asUser(ownerId, (tx) => tx`
      UPDATE resources SET name = 'Renamed' WHERE id = ${resourceId} RETURNING id, name
    `);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Renamed");
  });

  it("rejects deleting a resource the caller doesn't own", async () => {
    const ownerId = randomUUID();
    const someoneElse = randomUUID();
    const resourceId = await insertResource(ownerId);

    const rows = await asUser(someoneElse, (tx) => tx`
      DELETE FROM resources WHERE id = ${resourceId} RETURNING id
    `);

    expect(rows).toHaveLength(0);
  });

  it("allows the owner to delete their own resource", async () => {
    const ownerId = randomUUID();
    const resourceId = await insertResource(ownerId);

    const rows = await asUser(ownerId, (tx) => tx`
      DELETE FROM resources WHERE id = ${resourceId} RETURNING id
    `);

    expect(rows).toHaveLength(1);
  });
});

describe("bookings RLS", () => {
  it("prevents user A from reading user B's booking", async () => {
    const ownerId = randomUUID();
    const userA = randomUUID();
    const userB = randomUUID();
    const resourceId = await insertResource(ownerId);
    await insertBooking(resourceId, userB);

    const rows = await asUser(userA, (tx) => tx`
      SELECT id FROM bookings WHERE resource_id = ${resourceId}
    `);

    expect(rows).toHaveLength(0);
  });

  it("lets a user read their own booking", async () => {
    const ownerId = randomUUID();
    const userA = randomUUID();
    const resourceId = await insertResource(ownerId);
    await insertBooking(resourceId, userA);

    const rows = await asUser(userA, (tx) => tx`
      SELECT id FROM bookings WHERE resource_id = ${resourceId}
    `);

    expect(rows).toHaveLength(1);
  });

  it("lets a resource owner read bookings other users made on their resource", async () => {
    const ownerId = randomUUID();
    const someoneElse = randomUUID();
    const resourceId = await insertResource(ownerId);
    await insertBooking(resourceId, someoneElse);

    const rows = await asUser(ownerId, (tx) => tx`
      SELECT id FROM bookings WHERE resource_id = ${resourceId}
    `);

    expect(rows).toHaveLength(1);
  });

  it("denies anon any access at all — raw bookings aren't publicly readable", async () => {
    const ownerId = randomUUID();
    const resourceId = await insertResource(ownerId);
    await insertBooking(resourceId, randomUUID());

    // No SELECT grant for anon on bookings, so this fails on privilege
    // before RLS is even evaluated — a stronger guarantee than "zero
    // rows," which "public read of open slots only" requires: nothing
    // about who booked what leaks, not even row existence.
    await expect(
      asAnon((tx) => tx`SELECT id FROM bookings WHERE resource_id = ${resourceId}`),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("rejects a user cancelling someone else's booking", async () => {
    const ownerId = randomUUID();
    const userA = randomUUID();
    const userB = randomUUID();
    const resourceId = await insertResource(ownerId);
    const bookingId = await insertBooking(resourceId, userA);

    const rows = await asUser(userB, (tx) => tx`
      UPDATE bookings SET status = 'cancelled' WHERE id = ${bookingId} RETURNING id
    `);

    expect(rows).toHaveLength(0);
  });

  it("lets a user cancel their own booking", async () => {
    const ownerId = randomUUID();
    const userA = randomUUID();
    const resourceId = await insertResource(ownerId);
    const bookingId = await insertBooking(resourceId, userA);

    const rows = await asUser(userA, (tx) => tx`
      UPDATE bookings SET status = 'cancelled' WHERE id = ${bookingId}
      RETURNING id, status
    `);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("cancelled");
  });

  it("rejects a resource owner cancelling a booking made by someone else", async () => {
    // Deliberately narrower than the read policy: "their own bookings"
    // means the booker, not whoever owns the resource.
    const ownerId = randomUUID();
    const someoneElse = randomUUID();
    const resourceId = await insertResource(ownerId);
    const bookingId = await insertBooking(resourceId, someoneElse);

    const rows = await asUser(ownerId, (tx) => tx`
      UPDATE bookings SET status = 'cancelled' WHERE id = ${bookingId} RETURNING id
    `);

    expect(rows).toHaveLength(0);
  });

  it("rejects changing a booking's time through the cancel policy", async () => {
    // The UPDATE grant is column-scoped to status/cancelled_at — this
    // proves it's a real restriction, not just decorative, by trying to
    // slip an unrelated column through the same policy.
    const ownerId = randomUUID();
    const userA = randomUUID();
    const resourceId = await insertResource(ownerId);
    const bookingId = await insertBooking(resourceId, userA);

    await expect(
      asUser(userA, (tx) => tx`
        UPDATE bookings
        SET during = '[2026-08-11 10:00+00,2026-08-11 11:00+00)'::tstzrange
        WHERE id = ${bookingId}
      `),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

describe("booking_events RLS", () => {
  async function insertBookingEvent(bookingId: string) {
    const [row] = await db.execute<{ id: string }>(sql`
      INSERT INTO booking_events (booking_id, event)
      VALUES (${bookingId}, 'created')
      RETURNING id
    `);
    if (!row) throw new Error("insert did not return a row");
    return row.id;
  }

  it("lets the booking's own user read its events, but not an unrelated user", async () => {
    const ownerId = randomUUID();
    const userA = randomUUID();
    const unrelatedUser = randomUUID();
    const resourceId = await insertResource(ownerId);
    const bookingId = await insertBooking(resourceId, userA);
    await insertBookingEvent(bookingId);

    const ownRows = await asUser(userA, (tx) => tx`
      SELECT id FROM booking_events WHERE booking_id = ${bookingId}
    `);
    const unrelatedRows = await asUser(unrelatedUser, (tx) => tx`
      SELECT id FROM booking_events WHERE booking_id = ${bookingId}
    `);

    expect(ownRows).toHaveLength(1);
    expect(unrelatedRows).toHaveLength(0);
  });
});

describe("public_booking_windows view", () => {
  it("lets anon read a confirmed booking's window", async () => {
    const ownerId = randomUUID();
    const resourceId = await insertResource(ownerId);
    await insertBooking(resourceId, randomUUID());

    const rows = await asAnon<{ resource_id: string; starts_at: Date; ends_at: Date }[]>(
      (tx) => tx`
        SELECT resource_id, starts_at, ends_at
        FROM public_booking_windows
        WHERE resource_id = ${resourceId}
      `,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.resource_id).toBe(resourceId);
  });

  it("excludes cancelled bookings", async () => {
    const ownerId = randomUUID();
    const resourceId = await insertResource(ownerId);
    const bookingId = await insertBooking(resourceId, randomUUID());
    await db.execute(sql`UPDATE bookings SET status = 'cancelled' WHERE id = ${bookingId}`);

    const rows = await asAnon(
      (tx) => tx`SELECT resource_id FROM public_booking_windows WHERE resource_id = ${resourceId}`,
    );

    expect(rows).toHaveLength(0);
  });

  it("has no column exposing who booked it — not just access-denied, the data isn't there", async () => {
    const ownerId = randomUUID();
    const resourceId = await insertResource(ownerId);
    await insertBooking(resourceId, randomUUID());

    await expect(
      asAnon(
        (tx) => tx`SELECT user_id FROM public_booking_windows WHERE resource_id = ${resourceId}`,
      ),
    ).rejects.toMatchObject({ code: "42703" });
  });
});
