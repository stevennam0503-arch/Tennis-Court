-- Preserve existing bookings and their IDs/prices. Only unused future hourly slots
-- can be safely split; referenced historical slots remain unchanged.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT * FROM court_schedules s WHERE status='AVAILABLE' AND schedule_date>=CURRENT_DATE
   AND end_time-start_time=interval '1 hour'
   AND NOT EXISTS(SELECT FROM booking_slots b WHERE b.schedule_id=s.id)
   AND NOT EXISTS(SELECT FROM match_slots m WHERE m.schedule_id=s.id)
 LOOP
   UPDATE court_schedules SET end_time=r.start_time+interval '30 minutes',price=r.price/2 WHERE id=r.id;
   INSERT INTO court_schedules(id,court_id,schedule_date,start_time,end_time,price,status,version)
   VALUES(gen_random_uuid(),r.court_id,r.schedule_date,r.start_time+interval '30 minutes',r.end_time,r.price/2,'AVAILABLE',0);
 END LOOP;
 FOR r IN SELECT * FROM staff_schedules s WHERE status='AVAILABLE' AND work_date>=CURRENT_DATE
   AND end_time-start_time=interval '1 hour'
   AND NOT EXISTS(SELECT FROM booking_staff b WHERE b.staff_schedule_id=s.id)
   AND NOT EXISTS(SELECT FROM match_staff m WHERE m.staff_schedule_id=s.id)
 LOOP
   UPDATE staff_schedules SET end_time=r.start_time+interval '30 minutes' WHERE id=r.id;
   INSERT INTO staff_schedules(id,staff_id,work_date,start_time,end_time,status)
   VALUES(gen_random_uuid(),r.staff_id,r.work_date,r.start_time+interval '30 minutes',r.end_time,'AVAILABLE');
 END LOOP;
END $$;
ALTER TABLE team_members ADD COLUMN email varchar(254);
CREATE UNIQUE INDEX uq_tournament_player_email ON team_members(tournament_id,lower(email)) WHERE email IS NOT NULL;
-- Payment intents and provider events are persisted in app_documents, using the
-- existing transaction/advisory lock. Indexed prefixes support SQL reconciliation.
CREATE INDEX idx_documents_prefix ON app_documents(document_key text_pattern_ops);
