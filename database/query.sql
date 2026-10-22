-- Read-only diagnostic queries. Dates use the club timezone.
SET TIME ZONE 'Asia/Ho_Chi_Minh';
-- 1. Accounts and access roles (never return password hashes).
SELECT id, full_name, email, role, status, created_at FROM accounts ORDER BY role,email;
-- 2. Today's court map, available slots and exact duration/price.
SELECT c.name,c.status AS court_status,s.id,s.start_time,s.end_time,s.status,s.price,
 EXTRACT(EPOCH FROM s.end_time-s.start_time)/60 AS minutes
FROM court_schedules s JOIN courts c ON c.id=s.court_id
WHERE s.schedule_date=CURRENT_DATE ORDER BY c.name,s.start_time;
-- 3. Demo user's complete order history with recorded receipts and refunds.
SELECT o.id,o.customer_name,o.status,o.created_at,o.hold_expires_at,o.total_amount,o.deposit_required,o.paid_amount,
 CASE WHEN o.status IN ('CANCELLED','EXPIRED') THEN 0 ELSE greatest(0,o.total_amount-o.paid_amount) END AS amount_due,
 coalesce((SELECT sum(p.amount) FROM payments p WHERE p.order_id=o.id),0) AS gross_received,
 coalesce((SELECT sum(r.amount) FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE p.order_id=o.id),0) AS refunded,
 o.metadata::jsonb->>'financialReview' AS review
FROM orders o JOIN accounts a ON a.id=o.customer_account_id WHERE lower(a.email)='minh.anh@example.com' ORDER BY o.created_at DESC;
-- 4. Court allocations including release history.
SELECT o.id,o.status,c.name,s.schedule_date,s.start_time,s.end_time,bs.unit_price,bs.released_at
FROM orders o JOIN bookings b ON b.order_id=o.id JOIN booking_slots bs ON bs.booking_id=b.id
JOIN court_schedules s ON s.id=bs.schedule_id JOIN courts c ON c.id=s.court_id ORDER BY s.schedule_date DESC,s.start_time;
-- 5. Available referee profiles and half-hour shifts in the coming week.
SELECT st.id,st.full_name,st.level,st.hourly_rate,ss.work_date,ss.start_time,ss.end_time,ss.status
FROM staff st JOIN staff_schedules ss ON ss.staff_id=st.id
WHERE st.type='REFEREE' AND ss.work_date BETWEEN CURRENT_DATE AND CURRENT_DATE+7 ORDER BY ss.work_date,ss.start_time,st.full_name;
-- 6. Customer payment intents: declared transfers are not receipts.
SELECT document_key,data::jsonb->>'accountId' AS account_id,data::jsonb->>'type' AS type,
 data::jsonb->>'reference' AS reference,data::jsonb->>'status' AS status,
 data::jsonb->>'amount' AS requested,data::jsonb->>'received' AS verified,
 data::jsonb->>'reviewAmount' AS reconciliation,data::jsonb->>'expiresAt' AS expires
FROM app_documents WHERE document_key LIKE 'transfer:%';
-- 7. Unmatched/late/overpaid bank notifications requiring reconciliation.
SELECT document_key,data::jsonb FROM app_documents WHERE document_key LIKE 'bank-event:%' AND data::jsonb->>'status'='REVIEW';
-- 8. Detailed receipt/refund ledger and net revenue per day.
SELECT p.paid_at::date AS day,p.method,sum(p.amount) AS gross,
 sum(coalesce(r.refunded,0)) AS refunds,sum(p.amount-coalesce(r.refunded,0)) AS net
FROM payments p LEFT JOIN (SELECT payment_id,sum(amount) AS refunded FROM refunds GROUP BY payment_id) r ON r.payment_id=p.id
GROUP BY p.paid_at::date,p.method ORDER BY day DESC;
-- 9. Membership statuses, expiry and pending activations.
SELECT document_key,data::jsonb->>'name' AS customer,data::jsonb->>'planName' AS plan,
 data::jsonb->>'status' AS stored_status,data::jsonb->>'startsAt' AS starts_at,data::jsonb->>'endsAt' AS ends_at
FROM app_documents WHERE document_key LIKE 'membership:%';
-- 10. Tournament capacity and exact registered player identity.
SELECT t.id,t.name,t.format,t.status,t.registration_deadline,t.max_participants,
 count(r.id) FILTER(WHERE r.status<>'CANCELLED') AS entered,
 count(r.id) FILTER(WHERE r.status='CONFIRMED') AS confirmed
FROM tournaments t LEFT JOIN tournament_registrations r ON r.tournament_id=t.id GROUP BY t.id ORDER BY t.start_date;
SELECT t.name,r.team_name,r.status,m.member_name,m.email FROM team_members m JOIN tournaments t ON t.id=m.tournament_id JOIN tournament_registrations r ON r.id=m.registration_id ORDER BY t.name,r.team_name;
-- 11. Editorial content and feedback moderation (private feedback remains private).
SELECT document_key,data::jsonb->>'title' AS title,data::jsonb->>'status' AS status FROM app_documents WHERE document_key LIKE 'article:%';
SELECT document_key,data::jsonb->>'rating' AS rating,data::jsonb->>'publishConsent' AS consent,data::jsonb->>'status' AS status FROM app_documents WHERE document_key LIKE 'feedback:%';
-- 12. Invariant checks: each query below should return zero rows.
SELECT schedule_id,count(*) FROM booking_slots WHERE released_at IS NULL GROUP BY schedule_id HAVING count(*)>1;
SELECT staff_schedule_id,count(*) FROM booking_staff WHERE released_at IS NULL GROUP BY staff_schedule_id HAVING count(*)>1;
SELECT b.schedule_id FROM booking_slots b JOIN match_slots m ON m.schedule_id=b.schedule_id WHERE b.released_at IS NULL AND m.released_at IS NULL;
SELECT tournament_id,lower(email),count(*) FROM team_members WHERE email IS NOT NULL GROUP BY tournament_id,lower(email) HAVING count(*)>1;
SELECT o.id,o.paid_amount,coalesce(p.gross,0)-coalesce(r.total,0) AS ledger_net FROM orders o
LEFT JOIN (SELECT order_id,sum(amount) AS gross FROM payments GROUP BY order_id) p ON p.order_id=o.id
LEFT JOIN (SELECT p.order_id,sum(r.amount) AS total FROM refunds r JOIN payments p ON p.id=r.payment_id GROUP BY p.order_id) r ON r.order_id=o.id
WHERE o.paid_amount<>coalesce(p.gross,0)-coalesce(r.total,0);

-- 13. Required indoor/VIP courts; missing codes need migration or initial seeding.
WITH required(code) AS (VALUES ('B01'),('B02'),('B03'),('B04'),('V01'),('V02'))
SELECT r.code,c.id,c.name,c.status,c.base_price,
 CASE WHEN c.id IS NULL THEN 'MISSING' ELSE 'PRESENT' END AS catalog_check
FROM required r LEFT JOIN courts c
 ON upper(regexp_replace(trim(c.name), '^(Sân|San)\s+', '', 'i'))=r.code
ORDER BY r.code;
