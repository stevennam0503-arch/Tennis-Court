-- Run against a disposable V5 database with no courts.
-- psql -v ON_ERROR_STOP=1 -v migration=/path/to/V6__complete_indoor_and_vip_courts.sql -f this-file.sql
BEGIN;
DO $$ BEGIN
  IF EXISTS(SELECT FROM courts) THEN RAISE EXCEPTION 'Use an empty disposable V5 database'; END IF;
END $$;
\i :migration
DO $$ BEGIN
  IF EXISTS(SELECT FROM courts) THEN RAISE EXCEPTION 'V6 must leave empty databases for configured seeding'; END IF;
END $$;

INSERT INTO courts(id,name,type,status,base_price)
SELECT md5('legacy-court:'||n)::uuid,'Sân 0'||n,'HARD','ACTIVE',180000 FROM generate_series(1,4) n;
-- A configured indoor court must keep its ID, tariff, maintenance status and booking.
INSERT INTO courts(id,name,type,status,base_price)
VALUES(md5('existing-b01')::uuid,'Sân B01','HARD','MAINTENANCE',410000);
INSERT INTO court_schedules(id,court_id,schedule_date,start_time,end_time,price,status)
VALUES(md5('existing-slot')::uuid,md5('existing-b01')::uuid,CURRENT_DATE+1,'18:00','19:00',410000,'BOOKED');
INSERT INTO orders(id,customer_name,customer_phone,status,subtotal,total_amount,deposit_required,paid_amount,payment_status,created_at)
VALUES(md5('existing-order')::uuid,'Migration test','0900000000','CONFIRMED',410000,410000,205000,205000,'PARTIAL',now());
INSERT INTO bookings(id,order_id,status,created_at)
VALUES(md5('existing-booking')::uuid,md5('existing-order')::uuid,'CONFIRMED',now());
INSERT INTO booking_slots(id,booking_id,schedule_id,unit_price)
VALUES(md5('existing-booking-slot')::uuid,md5('existing-booking')::uuid,md5('existing-slot')::uuid,410000);
CREATE TEMP TABLE original_courts AS SELECT * FROM courts;
CREATE TEMP TABLE original_slots AS SELECT * FROM court_schedules;
CREATE TEMP TABLE original_orders AS SELECT * FROM orders;
CREATE TEMP TABLE original_bookings AS SELECT * FROM bookings;
CREATE TEMP TABLE original_booking_slots AS SELECT * FROM booking_slots;
\i :migration
\i :migration
DO $$ BEGIN
  IF (SELECT count(*) FROM courts)<>10 THEN RAISE EXCEPTION 'Expected four legacy courts + four indoor + two VIP, without duplicates'; END IF;
  IF (SELECT count(*) FROM courts WHERE name IN ('B02','B03','B04','V01','V02') AND status='ACTIVE')<>5 THEN RAISE EXCEPTION 'Missing active courts'; END IF;
  IF EXISTS(SELECT * FROM original_courts EXCEPT SELECT * FROM courts)
    OR EXISTS(SELECT * FROM original_slots EXCEPT SELECT * FROM court_schedules)
    OR EXISTS(SELECT * FROM original_orders EXCEPT SELECT * FROM orders)
    OR EXISTS(SELECT * FROM original_bookings EXCEPT SELECT * FROM bookings)
    OR EXISTS(SELECT * FROM original_booking_slots EXCEPT SELECT * FROM booking_slots)
  THEN RAISE EXCEPTION 'Existing data changed'; END IF;
  IF EXISTS(SELECT FROM courts WHERE name IN ('B02','B03','B04') AND base_price<>300000)
    OR EXISTS(SELECT FROM courts WHERE name IN ('V01','V02') AND base_price<>500000)
  THEN RAISE EXCEPTION 'Incorrect default prices'; END IF;
END $$;
ROLLBACK;
\echo 'PASS V6: empty database, missing courts, prefixed existing name, repeated execution and preserved bookings/prices/statuses.'
