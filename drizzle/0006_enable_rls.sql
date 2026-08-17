
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN 
        CREATE SCHEMA IF NOT EXISTS auth;

    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid

    LANGUAGE sql STABLE
    AS $fn$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
        $fn$;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN 
        CREATE ROLE authenticated NOLOGIN;

    END IF;

    GRANT USAGE ON SCHEMA public TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;

    END IF;

END $$;

CREATE TABLE booking_events (
    id bigserial PRIMARY KEY,
    booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    event text NOT NULL,
    actor_id uuid,
    payload jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
    );

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON resources TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON resources TO authenticated;


CREATE POLICY resources_public_read ON resources

    FOR SELECT 
    USING(true);

CREATE POLICY resources_owner_insert ON resources
    FOR INSERT 
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY resources_owner_update ON resources 
    FOR UPDATE 
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY resources_owner_delete ON resources 
    FOR DELETE
    USING (owner_id = auth.uid());


ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON bookings TO authenticated;


CREATE POLICY bookings_own_or_owner_select ON bookings 

    FOR SELECT 
    USING (user_id = auth.uid() OR resource_id IN (SELECT id FROM resources WHERE owner_id = auth.uid()));

CREATE POLICY bookings_self_insert ON bookings 

 FOR INSERT
 WITH CHECK(user_id = auth.uid());


ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON booking_events TO authenticated;

CREATE POLICY booking_events_creates_own_or_owner_select ON booking_events

FOR SELECT

USING(booking_id IN (SELECT id FROM bookings WHERE user_id = auth.uid() OR resource_id IN (SELECT id FROM resources WHERE owner_id = auth.uid()) ));