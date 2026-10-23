-- Courtly PostgreSQL 16 initialization, schema V1–V6. EMPTY DATABASE ONLY.
-- Existing databases: let the application run Flyway; do not import this file.
-- Includes the requested local admin account; no customer fixtures.
BEGIN;

-- V1__initial_schema.sql
-- Normalized entities based on the supplied tennis ERD.

CREATE TABLE accounts (
    id uuid PRIMARY KEY,
    full_name varchar(255) NOT NULL,
    email varchar(255) NOT NULL,
    phone varchar(255) NOT NULL,
    password_hash varchar(255),
    role varchar(255) NOT NULL,
    status varchar(255) NOT NULL,
    created_at timestamptz NOT NULL
);

CREATE TABLE courts (
    id uuid PRIMARY KEY,
    name varchar(255) NOT NULL,
    type varchar(255) NOT NULL,
    description text,
    image_url varchar(255),
    status varchar(255) NOT NULL,
    base_price numeric(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE court_prices (
    id uuid PRIMARY KEY,
    court_id uuid NOT NULL,
    day_type varchar(255) NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    price_per_hour numeric(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE court_schedules (
    id uuid PRIMARY KEY,
    court_id uuid NOT NULL,
    schedule_date date NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    price numeric(14,2) NOT NULL DEFAULT 0,
    status varchar(255) NOT NULL,
    version bigint NOT NULL DEFAULT 0
);

CREATE TABLE orders (
    id uuid PRIMARY KEY,
    customer_account_id uuid,
    created_by_account_id uuid,
    customer_name varchar(255) NOT NULL,
    customer_phone varchar(255) NOT NULL,
    status varchar(255) NOT NULL,
    hold_expires_at timestamptz,
    subtotal numeric(14,2) NOT NULL DEFAULT 0,
    total_amount numeric(14,2) NOT NULL DEFAULT 0,
    deposit_required numeric(14,2) NOT NULL DEFAULT 0,
    paid_amount numeric(14,2) NOT NULL DEFAULT 0,
    payment_status varchar(255) NOT NULL,
    invoice_number varchar(255),
    issued_at timestamptz,
    created_at timestamptz NOT NULL,
    version bigint NOT NULL DEFAULT 0
);

CREATE TABLE bookings (
    id uuid PRIMARY KEY,
    order_id uuid NOT NULL,
    status varchar(255) NOT NULL,
    check_in_at timestamptz,
    check_out_at timestamptz,
    created_at timestamptz NOT NULL
);

CREATE TABLE booking_slots (
    id uuid PRIMARY KEY,
    booking_id uuid NOT NULL,
    schedule_id uuid NOT NULL,
    unit_price numeric(14,2) NOT NULL DEFAULT 0,
    released_at timestamptz
);

CREATE TABLE booking_staff (
    id uuid PRIMARY KEY,
    booking_id uuid NOT NULL,
    staff_schedule_id uuid NOT NULL,
    unit_price numeric(14,2) NOT NULL DEFAULT 0,
    released_at timestamptz
);

CREATE TABLE drinks (
    id uuid PRIMARY KEY,
    name varchar(255) NOT NULL,
    unit varchar(255) NOT NULL,
    unit_price numeric(14,2) NOT NULL DEFAULT 0,
    stock_quantity integer NOT NULL DEFAULT 0,
    status varchar(255) NOT NULL
);

CREATE TABLE rental_items (
    id uuid PRIMARY KEY,
    name varchar(255) NOT NULL,
    category varchar(255) NOT NULL,
    brand varchar(255),
    price_per_hour numeric(14,2) NOT NULL DEFAULT 0,
    stock_quantity integer NOT NULL DEFAULT 0,
    status varchar(255) NOT NULL,
    version bigint NOT NULL DEFAULT 0
);

CREATE TABLE order_products (
    id uuid PRIMARY KEY,
    order_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    item_type varchar(255) NOT NULL,
    drink_id uuid,
    rental_item_id uuid,
    quantity integer NOT NULL DEFAULT 0,
    rent_start_at timestamptz,
    rent_end_at timestamptz,
    returned_at timestamptz,
    unit_price numeric(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE payments (
    id uuid PRIMARY KEY,
    order_id uuid,
    registration_id uuid,
    received_by_account_id uuid,
    type varchar(255) NOT NULL,
    method varchar(255) NOT NULL,
    amount numeric(14,2) NOT NULL DEFAULT 0,
    transaction_code varchar(255) NOT NULL,
    qr_content text,
    qr_expires_at timestamptz,
    status varchar(255) NOT NULL,
    paid_at timestamptz NOT NULL
);

CREATE TABLE refunds (
    id uuid PRIMARY KEY,
    payment_id uuid NOT NULL,
    amount numeric(14,2) NOT NULL DEFAULT 0,
    reason varchar(255) NOT NULL,
    status varchar(255) NOT NULL,
    processed_by_account_id uuid,
    refunded_at timestamptz NOT NULL
);

CREATE TABLE staff (
    id uuid PRIMARY KEY,
    full_name varchar(255) NOT NULL,
    phone varchar(255) NOT NULL,
    type varchar(255) NOT NULL,
    level varchar(255),
    hourly_rate numeric(14,2) NOT NULL DEFAULT 0,
    status varchar(255) NOT NULL
);

CREATE TABLE staff_schedules (
    id uuid PRIMARY KEY,
    staff_id uuid NOT NULL,
    work_date date NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    status varchar(255) NOT NULL,
    version bigint NOT NULL DEFAULT 0
);

CREATE TABLE tournaments (
    id uuid PRIMARY KEY,
    organizer_account_id uuid,
    name varchar(255) NOT NULL,
    format varchar(255) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    location varchar(255) NOT NULL,
    registration_fee numeric(14,2) NOT NULL DEFAULT 0,
    registration_deadline date NOT NULL,
    max_participants integer NOT NULL DEFAULT 0,
    status varchar(255) NOT NULL
);

CREATE TABLE tournament_registrations (
    id uuid PRIMARY KEY,
    tournament_id uuid NOT NULL,
    account_id uuid NOT NULL,
    registered_by_account_id uuid,
    team_name varchar(255) NOT NULL,
    skill_level varchar(255),
    status varchar(255) NOT NULL,
    registered_at timestamptz NOT NULL
);

CREATE TABLE team_members (
    id uuid PRIMARY KEY,
    registration_id uuid NOT NULL,
    tournament_id uuid NOT NULL,
    account_id uuid,
    member_name varchar(255),
    phone varchar(255)
);

CREATE TABLE matches (
    id uuid PRIMARY KEY,
    tournament_id uuid NOT NULL,
    registration1_id uuid,
    registration2_id uuid,
    winner_registration_id uuid,
    round_number integer NOT NULL DEFAULT 0,
    bracket_index integer NOT NULL DEFAULT 0,
    round_name varchar(255) NOT NULL,
    score varchar(255),
    status varchar(255) NOT NULL,
    updated_by_account_id uuid
);

CREATE TABLE match_slots (
    id uuid PRIMARY KEY,
    match_id uuid NOT NULL,
    schedule_id uuid NOT NULL,
    released_at timestamptz
);

CREATE TABLE match_staff (
    id uuid PRIMARY KEY,
    match_id uuid NOT NULL,
    staff_schedule_id uuid NOT NULL,
    role varchar(255) NOT NULL,
    released_at timestamptz
);

CREATE TABLE audit_logs (
    id uuid PRIMARY KEY,
    actor varchar(255) NOT NULL,
    action varchar(255) NOT NULL,
    detail text NOT NULL,
    created_at timestamptz NOT NULL
);

CREATE TABLE club_settings (
    id uuid PRIMARY KEY,
    hold_minutes integer NOT NULL DEFAULT 0,
    deposit_percent integer NOT NULL DEFAULT 0,
    cancel_refund_percent integer NOT NULL DEFAULT 0
);

ALTER TABLE court_prices ADD CONSTRAINT fk_court_prices_court_id FOREIGN KEY (court_id) REFERENCES courts(id);
ALTER TABLE court_schedules ADD CONSTRAINT fk_court_schedules_court_id FOREIGN KEY (court_id) REFERENCES courts(id);
ALTER TABLE orders ADD CONSTRAINT fk_orders_customer_account_id FOREIGN KEY (customer_account_id) REFERENCES accounts(id);
ALTER TABLE orders ADD CONSTRAINT fk_orders_created_by_account_id FOREIGN KEY (created_by_account_id) REFERENCES accounts(id);
ALTER TABLE bookings ADD CONSTRAINT fk_bookings_order_id FOREIGN KEY (order_id) REFERENCES orders(id);
ALTER TABLE booking_slots ADD CONSTRAINT fk_booking_slots_booking_id FOREIGN KEY (booking_id) REFERENCES bookings(id);
ALTER TABLE booking_slots ADD CONSTRAINT fk_booking_slots_schedule_id FOREIGN KEY (schedule_id) REFERENCES court_schedules(id);
ALTER TABLE booking_staff ADD CONSTRAINT fk_booking_staff_booking_id FOREIGN KEY (booking_id) REFERENCES bookings(id);
ALTER TABLE booking_staff ADD CONSTRAINT fk_booking_staff_staff_schedule_id FOREIGN KEY (staff_schedule_id) REFERENCES staff_schedules(id);
ALTER TABLE order_products ADD CONSTRAINT fk_order_products_order_id FOREIGN KEY (order_id) REFERENCES orders(id);
ALTER TABLE order_products ADD CONSTRAINT fk_order_products_booking_id FOREIGN KEY (booking_id) REFERENCES bookings(id);
ALTER TABLE order_products ADD CONSTRAINT fk_order_products_drink_id FOREIGN KEY (drink_id) REFERENCES drinks(id);
ALTER TABLE order_products ADD CONSTRAINT fk_order_products_rental_item_id FOREIGN KEY (rental_item_id) REFERENCES rental_items(id);
ALTER TABLE payments ADD CONSTRAINT fk_payments_order_id FOREIGN KEY (order_id) REFERENCES orders(id);
ALTER TABLE payments ADD CONSTRAINT fk_payments_registration_id FOREIGN KEY (registration_id) REFERENCES tournament_registrations(id);
ALTER TABLE payments ADD CONSTRAINT fk_payments_received_by_account_id FOREIGN KEY (received_by_account_id) REFERENCES accounts(id);
ALTER TABLE refunds ADD CONSTRAINT fk_refunds_payment_id FOREIGN KEY (payment_id) REFERENCES payments(id);
ALTER TABLE refunds ADD CONSTRAINT fk_refunds_processed_by_account_id FOREIGN KEY (processed_by_account_id) REFERENCES accounts(id);
ALTER TABLE staff_schedules ADD CONSTRAINT fk_staff_schedules_staff_id FOREIGN KEY (staff_id) REFERENCES staff(id);
ALTER TABLE tournaments ADD CONSTRAINT fk_tournaments_organizer_account_id FOREIGN KEY (organizer_account_id) REFERENCES accounts(id);
ALTER TABLE tournament_registrations ADD CONSTRAINT fk_tournament_registrations_tournament_id FOREIGN KEY (tournament_id) REFERENCES tournaments(id);
ALTER TABLE tournament_registrations ADD CONSTRAINT fk_tournament_registrations_account_id FOREIGN KEY (account_id) REFERENCES accounts(id);
ALTER TABLE tournament_registrations ADD CONSTRAINT fk_tournament_registrations_registered_by_account_id FOREIGN KEY (registered_by_account_id) REFERENCES accounts(id);
ALTER TABLE team_members ADD CONSTRAINT fk_team_members_registration_id FOREIGN KEY (registration_id) REFERENCES tournament_registrations(id);
ALTER TABLE team_members ADD CONSTRAINT fk_team_members_tournament_id FOREIGN KEY (tournament_id) REFERENCES tournaments(id);
ALTER TABLE team_members ADD CONSTRAINT fk_team_members_account_id FOREIGN KEY (account_id) REFERENCES accounts(id);
ALTER TABLE matches ADD CONSTRAINT fk_matches_tournament_id FOREIGN KEY (tournament_id) REFERENCES tournaments(id);
ALTER TABLE matches ADD CONSTRAINT fk_matches_registration1_id FOREIGN KEY (registration1_id) REFERENCES tournament_registrations(id);
ALTER TABLE matches ADD CONSTRAINT fk_matches_registration2_id FOREIGN KEY (registration2_id) REFERENCES tournament_registrations(id);
ALTER TABLE matches ADD CONSTRAINT fk_matches_winner_registration_id FOREIGN KEY (winner_registration_id) REFERENCES tournament_registrations(id);
ALTER TABLE matches ADD CONSTRAINT fk_matches_updated_by_account_id FOREIGN KEY (updated_by_account_id) REFERENCES accounts(id);
ALTER TABLE match_slots ADD CONSTRAINT fk_match_slots_match_id FOREIGN KEY (match_id) REFERENCES matches(id);
ALTER TABLE match_slots ADD CONSTRAINT fk_match_slots_schedule_id FOREIGN KEY (schedule_id) REFERENCES court_schedules(id);
ALTER TABLE match_staff ADD CONSTRAINT fk_match_staff_match_id FOREIGN KEY (match_id) REFERENCES matches(id);
ALTER TABLE match_staff ADD CONSTRAINT fk_match_staff_staff_schedule_id FOREIGN KEY (staff_schedule_id) REFERENCES staff_schedules(id);

-- V2__constraints_and_indexes.sql
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

-- V3__auth_content_and_current_booking.sql
ALTER TABLE accounts ADD COLUMN auth_version integer NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN metadata text NOT NULL DEFAULT '{}';
ALTER TABLE club_settings ADD COLUMN policies text NOT NULL DEFAULT '{}';
ALTER TABLE courts ADD COLUMN address text;
ALTER TABLE courts ADD COLUMN amenities text;
ALTER TABLE courts ADD COLUMN image_is_illustration boolean NOT NULL DEFAULT true;
ALTER TABLE booking_staff ADD COLUMN court_schedule_id uuid REFERENCES court_schedules(id);
ALTER TABLE order_products ADD COLUMN item_condition varchar(255);
ALTER TABLE order_products ADD COLUMN issued_at timestamptz;
-- Overpayments after a cheaper reschedule must remain visible for reconciliation.
DO $$ DECLARE c record; BEGIN FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='orders'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%paid_amount%' LOOP EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I',c.conname); END LOOP; END $$;
ALTER TABLE orders ADD CONSTRAINT chk_order_money CHECK(paid_amount>=0 AND total_amount>=0 AND deposit_required>=0 AND deposit_required<=total_amount);
CREATE TABLE app_documents (document_key varchar(255) PRIMARY KEY, data text NOT NULL, version bigint);

-- V4__configure_admin_account.sql
-- For nam-dev 931496f (UUID accounts schema, after V3).
-- One-time credential setup; preserve profile and invalidate existing sessions.
INSERT INTO accounts (id, full_name, email, phone, password_hash, role, status, created_at, auth_version)
VALUES (
    gen_random_uuid(), 'Quản trị viên', 'admin@gmail.com', '',
    '$2a$12$Vz8h4kTHkJihfSdtuexqI.kAACu2Pd5TZ/g/tSBOvoqAH9zZqdRpW',
    'ADMIN', 'ACTIVE', CURRENT_TIMESTAMP, 0
)
ON CONFLICT (lower(email)) DO UPDATE
SET email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    auth_version = accounts.auth_version + 1;

-- V5__customer_booking_support.sql
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

-- Upgrade existing installations that still have only the original four courts.
-- Empty databases are populated by DemoDataInitializer or the explicit SQL fixtures.
-- Existing court IDs, prices, statuses and bookings must remain unchanged.
INSERT INTO courts(id,name,type,description,image_url,status,base_price,address,amenities,image_is_illustration)
SELECT gen_random_uuid(), target.code, 'HARD',
       CASE WHEN target.code LIKE 'B%' THEN 'Sân tennis trong nhà' ELSE 'Sân tennis VIP' END,
       CASE WHEN target.code LIKE 'B%' THEN '/guest/zone-b-indoor.webp' ELSE '/guest/zone-v-lounge.webp' END,
       'ACTIVE', target.rate, '', '', true
FROM (VALUES ('B01',300000),('B02',300000),('B03',300000),('B04',300000),('V01',500000),('V02',500000)) AS target(code,rate)
WHERE EXISTS (SELECT FROM courts)
  AND NOT EXISTS (
    SELECT FROM courts c
    WHERE upper(regexp_replace(trim(c.name), '^(Sân|San)\s+', '', 'i')) = target.code
  );
-- PresentationService generates actual 30-minute schedules from each court's
-- tariff/base_price when a date is opened. No historical slots are rewritten.

-- Keep configured policies; fill missing customer cancellation/change deadlines.
UPDATE club_settings
SET hold_minutes = CASE WHEN hold_minutes = 10 THEN 5 ELSE hold_minutes END,
    policies = ('{"cancelCutoffMinutes":1440,"changeCutoffMinutes":1440}'::jsonb
                || policies::jsonb)::text;

-- Retain historical lines and receipts. No new beverage/equipment business.
UPDATE drinks SET status = 'INACTIVE';
UPDATE rental_items SET status = 'INACTIVE';

CREATE FUNCTION reject_retired_product_service() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Product services have been retired; only referee services may be added'
    USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER reject_new_order_products
BEFORE INSERT ON order_products
FOR EACH ROW EXECUTE FUNCTION reject_retired_product_service();

CREATE TABLE public.flyway_schema_history (
    installed_rank integer NOT NULL,
    version character varying(50),
    description character varying(200) NOT NULL,
    type character varying(20) NOT NULL,
    script character varying(1000) NOT NULL,
    checksum integer,
    installed_by character varying(100) NOT NULL,
    installed_on timestamp without time zone DEFAULT now() NOT NULL,
    execution_time integer NOT NULL,
    success boolean NOT NULL
);
ALTER TABLE public.flyway_schema_history ADD CONSTRAINT flyway_schema_history_pk PRIMARY KEY (installed_rank);
CREATE INDEX flyway_schema_history_s_idx ON public.flyway_schema_history (success);
INSERT INTO public.flyway_schema_history VALUES (1, '1', 'initial schema', 'SQL', 'V1__initial_schema.sql', 1085726566, 'courtly', '2026-10-21 03:46:14.776686', 170, true);
INSERT INTO public.flyway_schema_history VALUES (2, '2', 'constraints and indexes', 'SQL', 'V2__constraints_and_indexes.sql', 632382768, 'courtly', '2026-10-21 03:46:15.004874', 128, true);
INSERT INTO public.flyway_schema_history VALUES (3, '3', 'auth content and current booking', 'SQL', 'V3__auth_content_and_current_booking.sql', 1757165949, 'courtly', '2026-10-21 03:46:15.151607', 21, true);
INSERT INTO public.flyway_schema_history VALUES (4, '4', 'configure admin account', 'SQL', 'V4__configure_admin_account.sql', -1213621577, 'courtly', '2026-10-21 03:46:15.180967', 4, true);
INSERT INTO public.flyway_schema_history VALUES (5, '5', 'customer booking support', 'SQL', 'V5__customer_booking_support.sql', -17690139, 'courtly', '2026-10-21 03:46:15.196256', 10, true);
INSERT INTO public.flyway_schema_history VALUES (6, '6', 'complete indoor and vip courts', 'SQL', 'V6__complete_indoor_and_vip_courts.sql', -1950231639, current_user, now(), 0, true);
INSERT INTO public.flyway_schema_history VALUES (7, '7', 'customer booking policy', 'SQL', 'V7__customer_booking_policy.sql', -1721384287, current_user, now(), 0, true);
INSERT INTO public.flyway_schema_history VALUES (8, '8', 'retire product services', 'SQL', 'V8__retire_product_services.sql', 1243830135, current_user, now(), 0, true);
COMMIT;
