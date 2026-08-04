-- blocks is `during` widened by the resource's buffer_minutes on each
-- side. This has to be a trigger, not a generated column: the obvious
-- generated-column expression (tstzrange(lower(during) - interval,
-- upper(during) + interval)) is rejected by Postgres because interval
-- arithmetic on timestamptz is STABLE, not IMMUTABLE — it depends on
-- the session timezone for DST-crossing cases. See CLAUDE.md.
--
-- No backfill statement here: this migration always runs immediately
-- after bookings is created (migration 0002), in every environment,
-- so there are never existing rows to backfill.
ALTER TABLE bookings ADD COLUMN blocks tstzrange;

CREATE FUNCTION bookings_set_blocks() RETURNS trigger AS $$
DECLARE
	buffer int;
BEGIN
	SELECT buffer_minutes INTO buffer FROM resources WHERE id = NEW.resource_id;
	NEW.blocks := tstzrange(
		lower(NEW.during) - (buffer || ' minutes')::interval,
		upper(NEW.during) + (buffer || ' minutes')::interval,
		'[)'
	);
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_set_blocks_trigger
	BEFORE INSERT OR UPDATE ON bookings
	FOR EACH ROW
	EXECUTE FUNCTION bookings_set_blocks();

ALTER TABLE bookings ALTER COLUMN blocks SET NOT NULL;

-- THE centrepiece: no two live bookings for the same resource may
-- overlap. Partial on status = 'confirmed' so cancelled bookings don't
-- block new ones. Requires btree_gist (migration 0000) for the `=`
-- operator on resource_id inside a GiST index.
ALTER TABLE bookings
	ADD CONSTRAINT bookings_no_overlap
	EXCLUDE USING gist (resource_id WITH =, blocks WITH &&)
	WHERE (status = 'confirmed');
