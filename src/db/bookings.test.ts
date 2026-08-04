import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb } from "./client";
import { resources } from "./schema";

const db = createDb(process.env.TEST_DATABASE_URL!);

async function insertResource() {
  const [row] = await db
    .insert(resources)
    .values({
      ownerId: randomUUID(),
      name: "Room A",
      slug: `room-${randomUUID()}`,
      timezone: "Europe/Madrid",
    })
    .returning();
  if (!row) throw new Error("insert did not return a row");
  return row.id;
}

// bookings isn't declared in schema.ts (tstzrange has no Drizzle column
// type), so these go through raw sql — see the migration file's comment.
function insertBooking(resourceId: string, during: string, status?: string) {
  return status
    ? db.execute(
        sql`INSERT INTO bookings (resource_id, user_id, during, status) VALUES (${resourceId}, ${randomUUID()}, ${during}::tstzrange, ${status})`,
      )
    : db.execute(
        sql`INSERT INTO bookings (resource_id, user_id, during) VALUES (${resourceId}, ${randomUUID()}, ${during}::tstzrange)`,
      );
}

describe("bookings table constraints", () => {
  it("accepts a valid half-open range", async () => {
    const resourceId = await insertResource();
    await expect(
      insertBooking(resourceId, "[2026-08-10 10:00+00,2026-08-10 11:00+00)"),
    ).resolves.toBeDefined();
  });

  it("rejects an empty range", async () => {
    const resourceId = await insertResource();
    await expect(insertBooking(resourceId, "empty")).rejects.toMatchObject({
      cause: { code: "23514" },
    });
  });

  it("rejects an inclusive upper bound", async () => {
    const resourceId = await insertResource();
    await expect(
      insertBooking(resourceId, "[2026-08-10 10:00+00,2026-08-10 11:00+00]"),
    ).rejects.toMatchObject({
      cause: { code: "23514" },
    });
  });

  it("rejects an exclusive lower bound", async () => {
    const resourceId = await insertResource();
    await expect(
      insertBooking(resourceId, "(2026-08-10 10:00+00,2026-08-10 11:00+00)"),
    ).rejects.toMatchObject({
      cause: { code: "23514" },
    });
  });

  it("rejects a resource_id that doesn't exist", async () => {
    await expect(
      insertBooking(randomUUID(), "[2026-08-10 10:00+00,2026-08-10 11:00+00)"),
    ).rejects.toMatchObject({
      cause: { code: "23503" },
    });
  });

  it("rejects a status outside the enum", async () => {
    const resourceId = await insertResource();
    await expect(
      insertBooking(
        resourceId,
        "[2026-08-10 12:00+00,2026-08-10 13:00+00)",
        "pending",
      ),
    ).rejects.toMatchObject({
      cause: { code: "22P02" },
    });
  });
});
