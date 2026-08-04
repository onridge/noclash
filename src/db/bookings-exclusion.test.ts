import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb } from "./client";
import { extractPostgresCode, mapPostgresError } from "./errors";
import { resources } from "./schema";

const db = createDb(process.env.TEST_DATABASE_URL!);

async function insertResource(bufferMinutes = 0) {
  const [row] = await db
    .insert(resources)
    .values({
      ownerId: randomUUID(),
      name: "Room",
      slug: `room-${randomUUID()}`,
      timezone: "Europe/Madrid",
      bufferMinutes,
    })
    .returning();
  if (!row) throw new Error("insert did not return a row");
  return row.id;
}

function insertBooking(
  client: ReturnType<typeof createDb>,
  resourceId: string,
  during: string,
  status?: string,
) {
  return status
    ? client.execute(
        sql`INSERT INTO bookings (resource_id, user_id, during, status) VALUES (${resourceId}, ${randomUUID()}, ${during}::tstzrange, ${status})`,
      )
    : client.execute(
        sql`INSERT INTO bookings (resource_id, user_id, during) VALUES (${resourceId}, ${randomUUID()}, ${during}::tstzrange)`,
      );
}

describe("bookings_set_blocks trigger", () => {
  it("sets blocks equal to during when buffer_minutes is 0", async () => {
    const resourceId = await insertResource(0);
    await insertBooking(
      db,
      resourceId,
      "[2026-08-10 10:00+00,2026-08-10 11:00+00)",
    );
    const [row] = await db.execute<{ during: string; blocks: string }>(
      sql`SELECT during, blocks FROM bookings WHERE resource_id = ${resourceId}`,
    );
    expect(row?.blocks).toBe(row?.during);
  });

  it("widens blocks by buffer_minutes on each side", async () => {
    const resourceId = await insertResource(15);
    await insertBooking(
      db,
      resourceId,
      "[2026-08-10 10:00+00,2026-08-10 11:00+00)",
    );
    const [row] = await db.execute<{ blocks: string }>(
      sql`SELECT blocks FROM bookings WHERE resource_id = ${resourceId}`,
    );
    expect(row?.blocks).toBe(
      '["2026-08-10 09:45:00+00","2026-08-10 11:15:00+00")',
    );
  });
});

describe("bookings_no_overlap exclusion constraint", () => {
  it("rejects a sequential overlapping insert", async () => {
    const resourceId = await insertResource();
    await insertBooking(
      db,
      resourceId,
      "[2026-08-10 10:00+00,2026-08-10 11:00+00)",
    );
    await expect(
      insertBooking(db, resourceId, "[2026-08-10 10:30+00,2026-08-10 11:30+00)"),
    ).rejects.toMatchObject({ cause: { code: "23P01" } });
  });

  it("maps the real 23P01 error to a user-facing message", async () => {
    const resourceId = await insertResource();
    await insertBooking(
      db,
      resourceId,
      "[2026-08-10 10:00+00,2026-08-10 11:00+00)",
    );
    let caught: unknown;
    try {
      await insertBooking(
        db,
        resourceId,
        "[2026-08-10 10:30+00,2026-08-10 11:30+00)",
      );
    } catch (error) {
      caught = error;
    }
    expect(mapPostgresError(caught)).toBe("That slot was just taken.");
  });

  it("allows adjacent, non-overlapping bookings", async () => {
    const resourceId = await insertResource();
    await insertBooking(
      db,
      resourceId,
      "[2026-08-10 10:00+00,2026-08-10 11:00+00)",
    );
    await expect(
      insertBooking(db, resourceId, "[2026-08-10 11:00+00,2026-08-10 12:00+00)"),
    ).resolves.toBeDefined();
  });

  it("does not block on a cancelled overlapping booking", async () => {
    const resourceId = await insertResource();
    await insertBooking(
      db,
      resourceId,
      "[2026-08-10 10:00+00,2026-08-10 11:00+00)",
      "cancelled",
    );
    await expect(
      insertBooking(db, resourceId, "[2026-08-10 10:00+00,2026-08-10 11:00+00)"),
    ).resolves.toBeDefined();
  });

  // The project's thesis statement: the database, not application
  // check-then-insert, is what prevents a double-booking race. Two
  // genuinely separate connections fire conflicting inserts at the
  // same time with no await between them.
  it("under real concurrency, exactly one of two conflicting inserts succeeds", async () => {
    const resourceId = await insertResource();
    const clientA = createDb(process.env.TEST_DATABASE_URL!);
    const clientB = createDb(process.env.TEST_DATABASE_URL!);

    const results = await Promise.allSettled([
      insertBooking(
        clientA,
        resourceId,
        "[2026-08-10 10:00+00,2026-08-10 11:00+00)",
      ),
      insertBooking(
        clientB,
        resourceId,
        "[2026-08-10 10:30+00,2026-08-10 11:30+00)",
      ),
    ]);

    await clientA.$client.end();
    await clientB.$client.end();

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const [rejection] = rejected as PromiseRejectedResult[];
    // The loser can fail either as an exclusion violation (23P01) or,
    // under real contention, as a deadlock (40P01) if Postgres's
    // deadlock detector breaks the cycle before the exclusion check
    // runs — confirmed this actually happens in CI, not hypothetical.
    // Either way the database — not application code — is what
    // guaranteed only one booking survived, which is the actual thing
    // under test here.
    const code = extractPostgresCode(rejection?.reason);
    expect(["23P01", "40P01"]).toContain(code);
  });
});
