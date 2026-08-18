
CREATE VIEW public_booking_windows AS SELECT 
resource_id, 
lower(during) AS starts_at,
upper(during) AS ends_at
FROM bookings
WHERE status = 'confirmed';

GRANT SELECT ON public_booking_windows TO anon, authenticated;
