"use server";

import { sql, eq } from "drizzle-orm";
import { z } from "zod";
import { createDb, db } from "@/db/client";
import { mapPostgresError } from "@/db/errors";
import { formValue } from "@/lib/form-data";
import { resources } from "@/db/schema";
import { advanceWindowCutoff } from "@/lib/scheduling/advance-window";

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

const listBookingsSchema = z
  .object({
    resourceId: z.string().uuid(),
    from: z.iso.datetime({ offset: true }),
    to: z.iso.datetime({ offset: true }),
  })
  .refine((data) => new Date(data.to) > new Date(data.from), {
    message: "to must be after from",
    path: ["to"],
  });

export type ListBookingsInput = z.input<typeof listBookingsSchema>;

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

export interface BookingDto {
  id: string;
  resourceId: string;
  userId: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  notes: string | null;
}

function mapBookingRow(row: BookingRow): BookingDto {
  return {
    id: row.id,
    resourceId: row.resource_id,
    userId: row.user_id,
    startsAt: new Date(row.starts_at),
    endsAt: new Date(row.ends_at),
    status: row.status,
    notes: row.notes,
  };
}

export type CreateBookingResult =
  | { success: true; booking: BookingDto }
  | { success: false; error: string };

export type ListBookingsResult =
  | { success: true; bookings: BookingDto[] }
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

  const [resource] = await client
    .select({ maxAdvanceDays: resources.maxAdvanceDays })
    .from(resources)
    .where(eq(resources.id, parsed.data.resourceId));

  if (!resource) {
    return { success: false, error: "That resource no longer exists." };
  }

  const cutoff = advanceWindowCutoff(resource.maxAdvanceDays);

  if (new Date(parsed.data.startsAt) > cutoff) {
    return {
      success: false,
      error: `Booking can only be made up to ${resource.maxAdvanceDays} days in advance`,
    };
  }

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
    return { success: true, booking: mapBookingRow(row) };
  } catch (error) {
    return {
      success: false,
      error:
        mapPostgresError(error) ??
        "Something went wrong creating that booking.",
    };
  }
}

// Bookings whose range overlaps [from, to) at all, not just ones fully
// contained in it — matches calendar-view semantics (a booking that
// starts before the window and ends inside it should still show up),
// and uses the same && overlap operator the exclusion constraint itself
// relies on. Cancelled bookings are excluded: this reflects what's
// actually occupying the resource, not a change history.
export async function listBookings(
  input: unknown,
  client: ReturnType<typeof createDb> = db,
): Promise<ListBookingsResult> {
  const parsed = listBookingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid date window.",
    };
  }

  const { resourceId, from, to } = parsed.data;

  try {
    const rows = await client.execute<BookingRow>(sql`
      SELECT
        id,
        resource_id,
        user_id,
        lower(during) AS starts_at,
        upper(during) AS ends_at,
        status,
        notes
      FROM bookings
      WHERE resource_id = ${resourceId}
        AND status = 'confirmed'
        AND during && tstzrange(${from}::timestamptz, ${to}::timestamptz, '[)')
      ORDER BY lower(during) ASC
    `);
    return { success: true, bookings: rows.map(mapBookingRow) };
  } catch (error) {
    return {
      success: false,
      error:
        mapPostgresError(error) ??
        "Something went wrong loading bookings for that resource.",
    };
  }
}

export type BookingFormState =
  | { status: "idle" }
  | { status: "success"; booking: BookingDto }
  | { status: "error"; error: string };

export async function createBookingFromForm(
  _prevState: BookingFormState,
  formData: FormData,
  client: ReturnType<typeof createDb> = db,
): Promise<BookingFormState> {
  const resourceId = formValue(formData, "resourceId");
  const userId = formValue(formData, "userId");
  const date = formValue(formData, "date");
  const startTime = formValue(formData, "startTime");
  const endTime = formValue(formData, "endTime");
  const notes = formValue(formData, "notes").trim();

  const result = await createBooking(
    {
      resourceId,
      userId,
      startsAt: date && startTime ? `${date}T${startTime}:00Z` : "",
      endsAt: date && endTime ? `${date}T${endTime}:00Z` : "",
      notes: notes ? notes : undefined,
    },
    client,
  );

  if (!result.success) {
    return { status: "error", error: result.error };
  }

  return { status: "success", booking: result.booking };
}
