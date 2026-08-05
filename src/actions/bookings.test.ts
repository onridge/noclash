import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createBooking } from "./bookings";
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
