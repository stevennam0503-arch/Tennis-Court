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
