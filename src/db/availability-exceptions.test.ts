import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb } from "./client";
import { availabilityExceptions, resources } from "./schema";

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

describe("availability_exceptions table constraints", () => {
  it("accepts a closed-all-day exception with no times", async () => {
    const resourceId = await insertResource();
    const [row] = await db
      .insert(availabilityExceptions)
      .values({ resourceId, onDate: "2026-12-25", isClosed: true })
      .returning();
    expect(row?.isClosed).toBe(true);
    expect(row?.startsAt).toBeNull();
    expect(row?.endsAt).toBeNull();
  });

  it("accepts an extended-hours exception with both times", async () => {
    const resourceId = await insertResource();
    const [row] = await db
      .insert(availabilityExceptions)
      .values({
        resourceId,
        onDate: "2026-08-01",
        isClosed: false,
        startsAt: "09:00",
        endsAt: "22:00",
      })
      .returning();
    expect(row?.isClosed).toBe(false);
    expect(row?.startsAt).toBe("09:00:00");
    expect(row?.endsAt).toBe("22:00:00");
  });

  it("rejects a non-closed exception missing start/end times", async () => {
    const resourceId = await insertResource();
    await expect(
      db.insert(availabilityExceptions).values({
        resourceId,
        onDate: "2026-08-01",
        isClosed: false,
      }),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  });

  it("rejects a second exception for the same resource and date", async () => {
    const resourceId = await insertResource();
    await db
      .insert(availabilityExceptions)
      .values({ resourceId, onDate: "2026-12-25", isClosed: true });
    await expect(
      db.insert(availabilityExceptions).values({
        resourceId,
        onDate: "2026-12-25",
        isClosed: false,
        startsAt: "10:00",
        endsAt: "12:00",
      }),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
  });

  it("allows the same date for two different resources", async () => {
    const resourceIdA = await insertResource();
    const resourceIdB = await insertResource();
    await db
      .insert(availabilityExceptions)
      .values({ resourceId: resourceIdA, onDate: "2026-12-25", isClosed: true });
    await expect(
      db.insert(availabilityExceptions).values({
        resourceId: resourceIdB,
        onDate: "2026-12-25",
        isClosed: true,
      }),
    ).resolves.toBeDefined();
  });

  it("rejects a resource_id that doesn't exist", async () => {
    await expect(
      db.insert(availabilityExceptions).values({
        resourceId: randomUUID(),
        onDate: "2026-12-25",
        isClosed: true,
      }),
    ).rejects.toMatchObject({ cause: { code: "23503" } });
  });

  it("cascades on resource deletion", async () => {
    const resourceId = await insertResource();
    await db
      .insert(availabilityExceptions)
      .values({ resourceId, onDate: "2026-12-25", isClosed: true });

    await db.delete(resources).where(eq(resources.id, resourceId));

    const remaining = await db
      .select()
      .from(availabilityExceptions)
      .where(eq(availabilityExceptions.resourceId, resourceId));
    expect(remaining).toHaveLength(0);
  });
});
