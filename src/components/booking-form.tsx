"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  createBookingFromForm,
  type BookingFormState,
} from "@/actions/bookings";
import { formatDayHeading } from "@/lib/scheduling/day-window";
import { LocalTimeRange } from "./local-time-range";

const initialState: BookingFormState = { status: "idle" };

const inputClassName =
  "border border-rule bg-transparent px-3 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper";
const labelClassName = "flex flex-col gap-1.5 text-xs text-ink-muted";

export function BookingForm({
  resourceId,
  resourceTimezone,
}: {
  resourceId: string;
  resourceTimezone: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    createBookingFromForm,
    initialState,
  );
  // Track the exact state object the user dismissed, not a plain
  // boolean — comparing by reference means a fresh submission (a new
  // state object, even with the same error message) always shows again,
  // without needing an effect to reset a separate flag.
  const [dismissedState, setDismissedState] = useState<BookingFormState | null>(
    null,
  );

  // The day-view list above is rendered by the parent Server Component
  // and has no way to know a client-side form submission happened —
  // refresh it so a newly booked slot actually shows up without a
  // manual reload.
  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state, router]);

  const showError = state.status === "error" && state !== dismissedState;

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="resourceId" value={resourceId} />

      <label className={labelClassName}>
        Your user ID (temporary — Phase 3 adds real accounts)
        <input
          type="text"
          name="userId"
          required
          className={`${inputClassName} font-mono`}
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <label className={labelClassName}>
          Date
          <input type="date" name="date" required className={inputClassName} />
        </label>
        <label className={labelClassName}>
          Start (UTC)
          <input
            type="time"
            name="startTime"
            required
            className={inputClassName}
          />
        </label>
        <label className={labelClassName}>
          End (UTC)
          <input
            type="time"
            name="endTime"
            required
            className={inputClassName}
          />
        </label>
      </div>

      <label className={labelClassName}>
        Notes <span className="text-ink-muted">(optional)</span>
        <textarea name="notes" className={inputClassName} />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="self-start bg-accent px-6 py-2.5 text-sm font-semibold text-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:opacity-50"
      >
        {isPending ? "Booking…" : "Book"}
      </button>

      {/* Matches the "Inline — the slot-collision case" pattern from the
          design's Feedback Patterns reference: a bordered signal-tint
          bar with an explicit acknowledgement, not a toast — the moment
          calls for the visitor to choose again, not just a note that
          something happened. */}
      {showError && state.status === "error" && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border-t-2 border-signal bg-signal-tint px-3 py-2"
        >
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-signal">
              {state.error}
            </span>
            <span className="text-xs text-ink-muted">
              Choose another time above.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDismissedState(state)}
            className="border border-rule px-3 py-1.5 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-signal-tint"
          >
            Got it
          </button>
        </div>
      )}

      {state.status === "success" && (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-accent">
            Booked{" "}
            {formatDayHeading(
              state.booking.startsAt.toISOString().slice(0, 10),
            )}
          </p>
          <LocalTimeRange
            start={state.booking.startsAt}
            end={state.booking.endsAt}
            resourceTimezone={resourceTimezone}
          />
        </div>
      )}
    </form>
  );
}
