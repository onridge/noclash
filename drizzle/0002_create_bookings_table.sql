-- tstzrange has no native column-type support in Drizzle's schema
-- builder, so this table is hand-written raw SQL rather than
-- drizzle-kit generate.
--
-- user_id is a plain uuid with no FK for now, same reasoning as
-- resources.owner_id: auth.users doesn't exist until Phase 3.
--
-- blocks (the buffer-widened range) and the bookings_no_overlap
-- exclusion constraint are deliberately not part of this migration —
-- they belong together in a later migration alongside the trigger
-- that populates blocks, so this table stays insertable at every
-- migration checkpoint.
CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled');

CREATE TABLE bookings (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
	user_id uuid NOT NULL,
	during tstzrange NOT NULL,
	status booking_status NOT NULL DEFAULT 'confirmed',
	notes text,
	created_at timestamptz NOT NULL DEFAULT now(),
	cancelled_at timestamptz,
	CONSTRAINT bookings_during_not_empty CHECK (NOT isempty(during)),
	CONSTRAINT bookings_during_half_open CHECK (lower_inc(during) AND NOT upper_inc(during))
);
