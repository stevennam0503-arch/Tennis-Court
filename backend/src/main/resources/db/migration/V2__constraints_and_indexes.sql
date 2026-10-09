CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE UNIQUE INDEX uq_accounts_email ON accounts(lower(email));
CREATE UNIQUE INDEX uq_orders_invoice ON orders(invoice_number) WHERE invoice_number IS NOT NULL;
CREATE UNIQUE INDEX uq_payments_transaction ON payments(transaction_code);
ALTER TABLE courts ADD CHECK (base_price > 0);
ALTER TABLE court_prices ADD CHECK (price_per_hour > 0 AND end_time > start_time);
ALTER TABLE court_prices ADD CONSTRAINT no_court_price_overlap EXCLUDE USING gist
(court_id WITH =, day_type WITH =, tsrange(date '2000-01-01' + start_time, date '2000-01-01' + end_time, '[)') WITH &&);
ALTER TABLE court_schedules ADD CHECK (end_time > start_time AND price > 0);
ALTER TABLE court_schedules ADD CONSTRAINT uq_court_slot UNIQUE(court_id, schedule_date, start_time);
ALTER TABLE court_schedules ADD CONSTRAINT no_court_slot_overlap EXCLUDE USING gist
(court_id WITH =, tsrange(schedule_date + start_time, schedule_date + end_time, '[)') WITH &&);
ALTER TABLE staff_schedules ADD CHECK (end_time > start_time);
ALTER TABLE staff_schedules ADD CONSTRAINT uq_staff_slot UNIQUE(staff_id, work_date, start_time);
ALTER TABLE staff_schedules ADD CONSTRAINT no_staff_slot_overlap EXCLUDE USING gist
(staff_id WITH =, tsrange(work_date + start_time, work_date + end_time, '[)') WITH &&);
CREATE UNIQUE INDEX uq_active_booking_slot ON booking_slots(schedule_id) WHERE released_at IS NULL;
CREATE UNIQUE INDEX uq_active_match_slot ON match_slots(schedule_id) WHERE released_at IS NULL;
CREATE UNIQUE INDEX uq_active_booking_staff ON booking_staff(staff_schedule_id) WHERE released_at IS NULL;
CREATE UNIQUE INDEX uq_active_match_staff ON match_staff(staff_schedule_id) WHERE released_at IS NULL;
ALTER TABLE orders ADD CHECK (paid_amount >= 0 AND paid_amount <= total_amount AND deposit_required >= 0 AND deposit_required <= total_amount);
ALTER TABLE bookings ADD CHECK (check_out_at IS NULL OR (check_in_at IS NOT NULL AND check_out_at >= check_in_at));
ALTER TABLE bookings ADD CONSTRAINT uq_booking_order UNIQUE(id, order_id);
ALTER TABLE order_products ADD CONSTRAINT fk_product_booking_order FOREIGN KEY(booking_id, order_id) REFERENCES bookings(id,order_id);
ALTER TABLE order_products ADD CHECK (quantity > 0 AND unit_price > 0);
ALTER TABLE order_products ADD CHECK ((item_type='DRINK' AND drink_id IS NOT NULL AND rental_item_id IS NULL) OR (item_type='RENTAL' AND drink_id IS NULL AND rental_item_id IS NOT NULL AND rent_start_at IS NOT NULL AND rent_end_at > rent_start_at));
ALTER TABLE drinks ADD CHECK (unit_price > 0 AND stock_quantity >= 0);
ALTER TABLE rental_items ADD CHECK (price_per_hour > 0 AND stock_quantity >= 0);
ALTER TABLE staff ADD CHECK (hourly_rate > 0);
ALTER TABLE payments ADD CHECK (amount > 0 AND ((order_id IS NOT NULL AND registration_id IS NULL AND type IN ('DEPOSIT','BALANCE')) OR (order_id IS NULL AND registration_id IS NOT NULL AND type='TOURNAMENT_FEE')));
ALTER TABLE refunds ADD CHECK (amount > 0);
ALTER TABLE tournaments ADD CHECK (end_date >= start_date AND registration_deadline <= start_date AND registration_fee >= 0 AND max_participants >= 2);
ALTER TABLE tournament_registrations ADD CONSTRAINT uq_tournament_account UNIQUE(tournament_id, account_id);
ALTER TABLE tournament_registrations ADD CONSTRAINT uq_registration_tournament UNIQUE(id,tournament_id);
ALTER TABLE team_members ADD CONSTRAINT fk_member_registration_tournament FOREIGN KEY(registration_id,tournament_id) REFERENCES tournament_registrations(id,tournament_id);
CREATE UNIQUE INDEX uq_member_tournament_account ON team_members(tournament_id,account_id) WHERE account_id IS NOT NULL;
ALTER TABLE team_members ADD CHECK (account_id IS NOT NULL OR member_name IS NOT NULL);
ALTER TABLE matches ADD CONSTRAINT fk_reg1_tournament FOREIGN KEY(registration1_id,tournament_id) REFERENCES tournament_registrations(id,tournament_id);
ALTER TABLE matches ADD CONSTRAINT fk_reg2_tournament FOREIGN KEY(registration2_id,tournament_id) REFERENCES tournament_registrations(id,tournament_id);
ALTER TABLE matches ADD CONSTRAINT fk_winner_tournament FOREIGN KEY(winner_registration_id,tournament_id) REFERENCES tournament_registrations(id,tournament_id);
ALTER TABLE matches ADD CHECK (registration1_id IS NULL OR registration2_id IS NULL OR registration1_id <> registration2_id);
ALTER TABLE matches ADD CHECK (winner_registration_id IS NULL OR (registration1_id IS NOT NULL AND registration2_id IS NOT NULL AND winner_registration_id IN (registration1_id,registration2_id)));
ALTER TABLE matches ADD CONSTRAINT uq_bracket UNIQUE(tournament_id,round_number,bracket_index);
ALTER TABLE club_settings ADD CHECK (hold_minutes BETWEEN 1 AND 60 AND deposit_percent BETWEEN 1 AND 100 AND cancel_refund_percent BETWEEN 0 AND 100);
CREATE INDEX idx_orders_hold ON orders(status,hold_expires_at);
CREATE INDEX idx_orders_customer ON orders(customer_account_id);
CREATE INDEX idx_bookings_order ON bookings(order_id);
CREATE INDEX idx_booking_slots_booking ON booking_slots(booking_id);
CREATE INDEX idx_booking_staff_booking ON booking_staff(booking_id);
CREATE INDEX idx_products_order ON order_products(order_id);
CREATE INDEX idx_rental_overlap ON order_products(rental_item_id,rent_start_at,rent_end_at) WHERE returned_at IS NULL;
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_registration ON payments(registration_id);
CREATE INDEX idx_refunds_payment ON refunds(payment_id);
CREATE INDEX idx_audit_time ON audit_logs(created_at DESC);
-- Both allocation tables lock the same parent slot before checking the other table.
CREATE FUNCTION guard_court_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.released_at IS NULL THEN
  PERFORM id FROM court_schedules WHERE id=NEW.schedule_id FOR UPDATE;
  IF (TG_TABLE_NAME='booking_slots' AND EXISTS(SELECT 1 FROM match_slots WHERE schedule_id=NEW.schedule_id AND released_at IS NULL)) OR
     (TG_TABLE_NAME='match_slots' AND EXISTS(SELECT 1 FROM booking_slots WHERE schedule_id=NEW.schedule_id AND released_at IS NULL)) THEN
   RAISE EXCEPTION 'Court slot already allocated' USING ERRCODE='23505';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER guard_booking_slot BEFORE INSERT OR UPDATE ON booking_slots FOR EACH ROW EXECUTE FUNCTION guard_court_allocation();
CREATE TRIGGER guard_match_slot BEFORE INSERT OR UPDATE ON match_slots FOR EACH ROW EXECUTE FUNCTION guard_court_allocation();
CREATE FUNCTION guard_staff_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.released_at IS NULL THEN
  PERFORM id FROM staff_schedules WHERE id=NEW.staff_schedule_id FOR UPDATE;
  IF (TG_TABLE_NAME='booking_staff' AND EXISTS(SELECT 1 FROM match_staff WHERE staff_schedule_id=NEW.staff_schedule_id AND released_at IS NULL)) OR
     (TG_TABLE_NAME='match_staff' AND EXISTS(SELECT 1 FROM booking_staff WHERE staff_schedule_id=NEW.staff_schedule_id AND released_at IS NULL)) THEN
   RAISE EXCEPTION 'Staff slot already allocated' USING ERRCODE='23505';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER guard_booking_staff BEFORE INSERT OR UPDATE ON booking_staff FOR EACH ROW EXECUTE FUNCTION guard_staff_allocation();
CREATE TRIGGER guard_match_staff BEFORE INSERT OR UPDATE ON match_staff FOR EACH ROW EXECUTE FUNCTION guard_staff_allocation();
