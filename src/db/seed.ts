import { sql } from "drizzle-orm";
import { createDb } from "./client";
import { resources } from "./schema";
import { randomUUID } from "node:crypto";
import { createBooking } from "@/actions/bookings";

export async function seed(client: ReturnType<typeof createDb>) {
  await client.execute(
    sql`TRUNCATE bookings, resources RESTART IDENTITY CASCADE`,
  );

  const [resource] = await client
    .insert(resources)
    .values({
      ownerId: randomUUID(),
      name: "Rehearsal Room B",
      slug: "rehearsal-room-b",
      timezone: "America/Los_Angeles",
      bufferMinutes: 15,
    })
    .returning();

  if (!resource) throw new Error("seed: resource insert returned no row");

  const today = new Date();

  const dayOffset = (days: number, hour: number, minute = 0) => {
    const d = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() + days,
        hour,
        minute,
      ),
    );

    return d.toISOString();
  };

  const bookings = [
    {
      start: dayOffset(1, 10),
      end: dayOffset(1, 11),
      notes: "Full band rehearsal",
    },
    {
      start: dayOffset(1, 14),
      end: dayOffset(1, 18),
      notes: "The Late Shift",
    },
    {
      start: dayOffset(2, 9),
      end: dayOffset(2, 11),
      notes: undefined,
    },
    {
      start: dayOffset(4, 15, 30),
      end: dayOffset(4, 17),
      notes: "Nadia Chen",
    },
  ];

  for (const b of bookings) {
    const result = await createBooking(
      {
        resourceId: resource.id,
        userId: randomUUID(),
        startsAt: b.start,
        endsAt: b.end,
        notes: b.notes,
      },
      client,
    );

    if (!result.success)
      throw new Error(`seed: booking insert failed:${result.error}`);
  }

  return { resource, bookingCount: bookings.length };
}
