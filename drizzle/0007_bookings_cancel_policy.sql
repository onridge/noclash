
GRANT UPDATE (status, cancelled_at) ON bookings TO authenticated;

CREATE POLICY bookings_self_cancel ON bookings
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND status = 'cancelled');