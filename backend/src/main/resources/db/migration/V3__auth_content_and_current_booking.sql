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
