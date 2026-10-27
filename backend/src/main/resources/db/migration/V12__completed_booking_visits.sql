ALTER TABLE booking_slots ADD COLUMN completed_at timestamptz;
ALTER TABLE booking_staff ADD COLUMN completed_at timestamptz;
-- Recover only the actually completed latest allocation, never future visits.
UPDATE booking_slots bs SET completed_at = bs.released_at
FROM bookings b, court_schedules cs
WHERE bs.booking_id = b.id AND bs.schedule_id = cs.id AND b.status = 'COMPLETED'
  AND bs.released_at IS NOT NULL AND b.check_out_at IS NOT NULL
  AND cs.schedule_date <= (b.check_out_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
  AND bs.released_at = (SELECT max(x.released_at) FROM booking_slots x WHERE x.booking_id=b.id);
UPDATE booking_staff st SET completed_at = st.released_at
WHERE EXISTS (SELECT 1 FROM booking_slots bs WHERE bs.booking_id=st.booking_id
 AND bs.schedule_id=st.court_schedule_id AND bs.completed_at=st.released_at);
-- Previously released future bookings must be reviewed, not re-reserved blindly.
UPDATE orders o SET metadata = (metadata::jsonb || '{"financialReview":"RECURRING_VISITS_REVIEW"}'::jsonb)::text
WHERE o.status='COMPLETED' AND EXISTS (
 SELECT 1 FROM bookings b JOIN booking_slots bs ON bs.booking_id=b.id
 JOIN court_schedules cs ON cs.id=bs.schedule_id
 WHERE b.order_id=o.id AND b.check_out_at IS NOT NULL
 AND cs.schedule_date > (b.check_out_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date);
-- Keep a deterministic active visit when upgrading a booking currently in play.
UPDATE orders o SET metadata = (metadata::jsonb || jsonb_build_object('activeVisitDate', (
 SELECT min(cs.schedule_date)::text FROM bookings b JOIN booking_slots bs ON bs.booking_id=b.id
 JOIN court_schedules cs ON cs.id=bs.schedule_id WHERE b.order_id=o.id AND bs.released_at IS NULL
)))::text WHERE o.status='CHECKED_IN' AND NOT (metadata::jsonb ? 'activeVisitDate');
