"use server";

import { sql } from "drizzle-orm";
import { z } from "zod";
import { createDb, db } from "@/db/client";
import { mapPostgresError } from "@/db/errors";

// startsAt/endsAt require an explicit UTC offset (or Z) — the client
// must send an unambiguous instant, never local wall-clock time.
const createBookingSchema = z
  .object({
    resourceId: z.string().uuid(),
    userId: z.string().uuid(),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    notes: z.string().trim().min(1).max(2000).optional(),
  })
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  });

export type CreateBookingInput = z.input<typeof createBookingSchema>;

interface BookingRow extends Record<string, unknown> {
  id: string;
  resource_id: string;
  user_id: string;
  // Drizzle's raw execute() returns timestamptz as Postgres's text
  // representation (e.g. "2026-08-10 10:00:00+00"), not a parsed Date —
  // confirmed by comparing against the raw postgres.js driver, which
  // does parse it. Parsed into Date below before returning.
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
}

export type CreateBookingResult =
  | {
      success: true;
      booking: {
        id: string;
        resourceId: string;
        userId: string;
        startsAt: Date;
        endsAt: Date;
        status: string;
        notes: string | null;
      };
    }
  | { success: false; error: string };

// `client` defaults to the app's shared connection but can be overridden
// (e.g. a TEST_DATABASE_URL client in tests) — bookings isn't a Drizzle
// table (tstzrange has no column-type support, see the migration
// comments), so this always goes through raw sql rather than
// db.insert(bookings).
export async function createBooking(
  input: unknown,
  client: ReturnType<typeof createDb> = db,
): Promise<CreateBookingResult> {
  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid booking details.",
    };
  }

  const { resourceId, userId, startsAt, endsAt, notes } = parsed.data;

  try {
    const rows = await client.execute<BookingRow>(sql`
      INSERT INTO bookings (resource_id, user_id, during, notes)
      VALUES (
        ${resourceId},
        ${userId},
        tstzrange(${startsAt}::timestamptz, ${endsAt}::timestamptz, '[)'),
        ${notes ?? null}
      )
      RETURNING
        id,
        resource_id,
        user_id,
        lower(during) AS starts_at,
        upper(during) AS ends_at,
        status,
        notes
    `);
    const row = rows[0];
    if (!row) {
      return {
        success: false,
        error: "Something went wrong creating that booking.",
      };
    }
    return {
      success: true,
      booking: {
        id: row.id,
        resourceId: row.resource_id,
        userId: row.user_id,
        startsAt: new Date(row.starts_at),
        endsAt: new Date(row.ends_at),
        status: row.status,
        notes: row.notes,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        mapPostgresError(error) ??
        "Something went wrong creating that booking.",
    };
  }
}
