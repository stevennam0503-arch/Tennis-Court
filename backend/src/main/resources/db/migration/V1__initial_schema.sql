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
