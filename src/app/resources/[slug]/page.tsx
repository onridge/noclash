import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listBookings } from "@/actions/bookings";
import { db } from "@/db/client";
import { resources } from "@/db/schema";
import {
  dayWindow,
  formatDayHeading,
  formatTimeUtc,
  parseDateParam,
  shiftDate,
} from "@/lib/scheduling/day-window";
import { BookingForm } from "@/components/booking-form";

export default async function ResourceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { slug } = await params;
  const { date: dateParam } = await searchParams;

  const [resource] = await db
    .select()
    .from(resources)
    .where(eq(resources.slug, slug));
  if (!resource) {
    notFound();
  }

  const date = parseDateParam(dateParam);
  const { from, to } = dayWindow(date);
  const result = await listBookings({ resourceId: resource.id, from, to });
  const bookings = result.success ? result.bookings : [];

  const prevDate = shiftDate(date, -1);
  const nextDate = shiftDate(date, 1);

  return (
    <main className="px-4 sm:px-6 py-6">
      <p className="text-xs uppercase tracking-wide text-ink-muted mb-1">
        {resource.timezone} (times shown in UTC)
      </p>
      <h1 className="font-display text-3xl sm:text-4xl text-ink">
        {resource.name}
      </h1>

      <div className="mt-5 flex items-center justify-between border-b border-rule pb-3">
        <Link
          href={`?date=${prevDate}`}
          className="text-sm text-accent underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          &larr; Prev
        </Link>
        <span className="font-mono text-sm text-ink">
          {formatDayHeading(date)}
        </span>
        <Link
          href={`?date=${nextDate}`}
          className="text-sm text-accent underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          Next &rarr;
        </Link>
      </div>

      {bookings.length === 0 ? (
        <div className="py-16 text-center border-b border-rule my-4">
          <p className="italic font-mono text-ink-muted text-base">
            &mdash; nothing scheduled &mdash;
          </p>
        </div>
      ) : (
        <ul className="pt-2 flex flex-col">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              className="flex items-center justify-between gap-3 py-3 border-b border-rule text-ink"
            >
              <span className="font-mono text-lg tabular-nums">
                {formatTimeUtc(booking.startsAt)} &ndash;{" "}
                {formatTimeUtc(booking.endsAt)}
              </span>
              {booking.notes && (
                <span className="text-sm text-ink-muted">{booking.notes}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <BookingForm resourceId={resource.id} />
    </main>
  );
}
