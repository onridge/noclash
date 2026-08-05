import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createBooking, listBookings } from "./bookings";
import { createDb } from "@/db/client";
import { resources } from "@/db/schema";

const testDb = createDb(process.env.TEST_DATABASE_URL!);

async function insertResource() {
  const [row] = await testDb
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

async function insertBooking(
  resourceId: string,
  startsAt: string,
  endsAt: string,
  status: "confirmed" | "cancelled" = "confirmed",
) {
  const result = await createBooking(
    { resourceId, userId: randomUUID(), startsAt, endsAt },
    testDb,
  );
  if (!result.success) throw new Error(`setup insert failed: ${result.error}`);
  if (status === "cancelled") {
    await testDb.execute(
      sql`UPDATE bookings SET status = 'cancelled' WHERE id = ${result.booking.id}`,
    );
  }
  return result.booking;
}

describe("createBooking", () => {
  it("creates a booking from valid input", async () => {
    const resourceId = await insertResource();
    const result = await createBooking(
      {
        resourceId,
        userId: randomUUID(),
        startsAt: "2026-08-10T10:00:00Z",
        endsAt: "2026-08-10T11:00:00Z",
        notes: "First visit",
      },
      testDb,
    );

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.booking.resourceId).toBe(resourceId);
    expect(result.booking.status).toBe("confirmed");
    expect(result.booking.notes).toBe("First visit");
    expect(result.booking.startsAt.toISOString()).toBe("2026-08-10T10:00:00.000Z");
    expect(result.booking.endsAt.toISOString()).toBe("2026-08-10T11:00:00.000Z");
  });

  it("rejects an invalid resourceId", async () => {
    const result = await createBooking(
      {
        resourceId: "not-a-uuid",
        userId: randomUUID(),
        startsAt: "2026-08-10T10:00:00Z",
        endsAt: "2026-08-10T11:00:00Z",
      },
      testDb,
    );
    expect(result).toMatchObject({ success: false });
  });

  it("rejects startsAt without a UTC offset", async () => {
    const resourceId = await insertResource();
    const result = await createBooking(
      {
        resourceId,
        userId: randomUUID(),
        startsAt: "2026-08-10T10:00:00",
        endsAt: "2026-08-10T11:00:00Z",
      },
      testDb,
    );
    expect(result).toMatchObject({ success: false });
  });

  it("rejects endsAt at or before startsAt", async () => {
    const resourceId = await insertResource();
    const result = await createBooking(
      {
        resourceId,
        userId: randomUUID(),
        startsAt: "2026-08-10T11:00:00Z",
        endsAt: "2026-08-10T10:00:00Z",
      },
      testDb,
    );
    expect(result).toMatchObject({
      success: false,
      error: "endsAt must be after startsAt",
    });
  });

  it("returns a friendly message when the slot was just taken", async () => {
    const resourceId = await insertResource();
    await createBooking(
      {
        resourceId,
        userId: randomUUID(),
        startsAt: "2026-08-10T10:00:00Z",
        endsAt: "2026-08-10T11:00:00Z",
      },
      testDb,
    );

    const result = await createBooking(
      {
        resourceId,
        userId: randomUUID(),
        startsAt: "2026-08-10T10:30:00Z",
        endsAt: "2026-08-10T11:30:00Z",
      },
      testDb,
    );

    expect(result).toEqual({
      success: false,
      error: "That slot was just taken.",
    });
  });

  it("returns a friendly message when the resource doesn't exist", async () => {
    const result = await createBooking(
      {
        resourceId: randomUUID(),
        userId: randomUUID(),
        startsAt: "2026-08-10T10:00:00Z",
        endsAt: "2026-08-10T11:00:00Z",
      },
      testDb,
    );

    expect(result).toEqual({
      success: false,
      error: "That resource no longer exists.",
    });
  });
});

describe("listBookings", () => {
  it("returns an empty list for a resource with no bookings", async () => {
    const resourceId = await insertResource();
    const result = await listBookings(
      { resourceId, from: "2026-08-01T00:00:00Z", to: "2026-08-31T00:00:00Z" },
      testDb,
    );
    expect(result).toEqual({ success: true, bookings: [] });
  });

  it("includes bookings fully inside the window, ordered by start time", async () => {
    const resourceId = await insertResource();
    await insertBooking(
      resourceId,
      "2026-08-10T14:00:00Z",
      "2026-08-10T15:00:00Z",
    );
    await insertBooking(
      resourceId,
      "2026-08-10T10:00:00Z",
      "2026-08-10T11:00:00Z",
    );

    const result = await listBookings(
      { resourceId, from: "2026-08-10T00:00:00Z", to: "2026-08-11T00:00:00Z" },
      testDb,
    );

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.bookings).toHaveLength(2);
    expect(result.bookings[0]?.startsAt.toISOString()).toBe(
      "2026-08-10T10:00:00.000Z",
    );
    expect(result.bookings[1]?.startsAt.toISOString()).toBe(
      "2026-08-10T14:00:00.000Z",
    );
  });

  it("includes a booking that only partially overlaps the window", async () => {
    const resourceId = await insertResource();
    // starts before the window, ends inside it
    await insertBooking(
      resourceId,
      "2026-08-09T22:00:00Z",
      "2026-08-10T01:00:00Z",
    );

    const result = await listBookings(
      { resourceId, from: "2026-08-10T00:00:00Z", to: "2026-08-11T00:00:00Z" },
      testDb,
    );

    expect(result).toMatchObject({ success: true, bookings: [{}] });
  });

  it("excludes bookings entirely outside the window", async () => {
    const resourceId = await insertResource();
    await insertBooking(
      resourceId,
      "2026-08-12T10:00:00Z",
      "2026-08-12T11:00:00Z",
    );

    const result = await listBookings(
      { resourceId, from: "2026-08-10T00:00:00Z", to: "2026-08-11T00:00:00Z" },
      testDb,
    );

    expect(result).toEqual({ success: true, bookings: [] });
  });

  it("excludes cancelled bookings", async () => {
    const resourceId = await insertResource();
    await insertBooking(
      resourceId,
      "2026-08-10T10:00:00Z",
      "2026-08-10T11:00:00Z",
      "cancelled",
    );

    const result = await listBookings(
      { resourceId, from: "2026-08-10T00:00:00Z", to: "2026-08-11T00:00:00Z" },
      testDb,
    );

    expect(result).toEqual({ success: true, bookings: [] });
  });

  it("excludes bookings for other resources", async () => {
    const resourceId = await insertResource();
    const otherResourceId = await insertResource();
    await insertBooking(
      otherResourceId,
      "2026-08-10T10:00:00Z",
      "2026-08-10T11:00:00Z",
    );

    const result = await listBookings(
      { resourceId, from: "2026-08-10T00:00:00Z", to: "2026-08-11T00:00:00Z" },
      testDb,
    );

    expect(result).toEqual({ success: true, bookings: [] });
  });

  it("rejects an invalid resourceId", async () => {
    const result = await listBookings(
      {
        resourceId: "not-a-uuid",
        from: "2026-08-10T00:00:00Z",
        to: "2026-08-11T00:00:00Z",
      },
      testDb,
    );
    expect(result).toMatchObject({ success: false });
  });

  it("rejects to at or before from", async () => {
    const resourceId = await insertResource();
    const result = await listBookings(
      { resourceId, from: "2026-08-11T00:00:00Z", to: "2026-08-10T00:00:00Z" },
      testDb,
    );
    expect(result).toMatchObject({
      success: false,
      error: "to must be after from",
    });
  });
});
