-- TEST DATA ONLY. Explicit opt-in required in the SAME psql session:
-- psql ... -c "SET courtly.allow_test_data='on'" -f database/test_data.sql
-- Relative dates follow Asia/Ho_Chi_Minh. Rerunning does not duplicate fixtures.
BEGIN;
SET LOCAL TIME ZONE 'Asia/Ho_Chi_Minh';
DO $$ BEGIN
 IF current_setting('courtly.allow_test_data',true) IS DISTINCT FROM 'on' THEN
  RAISE EXCEPTION 'Test fixtures require SET courtly.allow_test_data=on; use a disposable database';
 END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE FUNCTION pg_temp.demo_id(key text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT md5('courtly-handoff-demo:'||key)::uuid $$;
DO $$
DECLARE
 n int; d int; k int; h int; c uuid; a uuid; o uuid; b uuid; s uuid; p uuid; r uuid; tr uuid; total numeric; paid numeric;
 state text; code text; rate numeric; day date; admin uuid; demo uuid; passwd text;
BEGIN
 IF EXISTS(SELECT FROM app_documents WHERE document_key='fixture:handoff-v1') THEN RAISE NOTICE 'Demo already installed; no data changed'; RETURN; END IF;
 SELECT id INTO admin FROM accounts WHERE lower(email)='admin@gmail.com';
 IF admin IS NULL THEN RAISE EXCEPTION 'Apply V4 admin migration first'; END IF;
 passwd:=crypt('CourtlyDemo2026',gen_salt('bf',12));
 demo:=pg_temp.demo_id('user:1');
 FOR n IN 1..30 LOOP
  a:=pg_temp.demo_id('user:'||n);
  INSERT INTO accounts(id,full_name,email,phone,password_hash,role,status,created_at,auth_version)
  VALUES(a,CASE n WHEN 1 THEN 'Nguyễn Minh Anh' ELSE 'Khách demo '||n END,
    CASE n WHEN 1 THEN 'minh.anh@example.com' ELSE 'player'||n||'@courtly.example' END,
    '090'||lpad(n::text,7,'0'),passwd,'CUSTOMER',CASE WHEN n=30 THEN 'LOCKED' ELSE 'ACTIVE' END,now()-interval '60 days',0);
 END LOOP;
 INSERT INTO club_settings(id,hold_minutes,deposit_percent,cancel_refund_percent,policies)
 SELECT pg_temp.demo_id('settings'),15,50,50,'{"cancelCutoffMinutes":60,"changeCutoffMinutes":60,"checkInEarlyMinutes":30}' WHERE NOT EXISTS(SELECT FROM club_settings);
 FOR n IN 1..10 LOOP
  c:=pg_temp.demo_id('court:'||n);code:=CASE WHEN n<=4 THEN 'A'||lpad(n::text,2,'0') WHEN n<=8 THEN 'B'||lpad((n-4)::text,2,'0') ELSE 'V'||lpad((n-8)::text,2,'0') END;
  rate:=CASE WHEN n<=4 THEN 200000 WHEN n<=8 THEN 300000 ELSE 500000 END;
  INSERT INTO courts(id,name,type,description,image_url,status,base_price,address,amenities,image_is_illustration)
  VALUES(c,code,'HARD','Sân mẫu phục vụ kiểm thử, không phải cơ sở thực tế',CASE WHEN n<=4 THEN '/guest/zone-a-outdoor.webp' WHEN n<=8 THEN '/guest/zone-b-indoor.webp' ELSE '/guest/zone-v-lounge.webp' END,'ACTIVE',rate,'DEMO · Khu thể thao Courtly','Phòng tắm, bãi xe, khu nghỉ',true);
  FOR k IN 1..2 LOOP INSERT INTO court_prices(id,court_id,day_type,start_time,end_time,price_per_hour) VALUES(pg_temp.demo_id('price:'||n||':'||k),c,CASE k WHEN 1 THEN 'WEEKDAY' ELSE 'WEEKEND' END,'06:00','23:00',rate);END LOOP;
  FOR d IN -30..30 LOOP
   FOR h IN 12..45 LOOP
    INSERT INTO court_schedules(id,court_id,schedule_date,start_time,end_time,price,status,version)
    VALUES(pg_temp.demo_id('slot:'||n||':'||d||':'||h),c,CURRENT_DATE+d,(time '00:00'+h*interval '30 minutes')::time,(time '00:00'+(h+1)*interval '30 minutes')::time,rate/2,'AVAILABLE',0);
   END LOOP;
  END LOOP;
 END LOOP;
 FOR n IN 1..8 LOOP
  a:=pg_temp.demo_id('staff:'||n);
  INSERT INTO staff(id,full_name,phone,type,level,hourly_rate,status) VALUES(a,
   CASE n WHEN 1 THEN 'Trọng tài Quốc Huy' WHEN 2 THEN 'Trọng tài Thanh Bình' WHEN 3 THEN 'Trọng tài Hoài An' ELSE 'Nhân sự demo '||n END,
   '091'||lpad(n::text,7,'0'),CASE WHEN n<=3 THEN 'REFEREE' ELSE 'COACH' END,
   CASE n WHEN 1 THEN '5 năm · Giải phong trào, đơn và đôi' WHEN 2 THEN '8 năm · Giải cấp câu lạc bộ' ELSE '3 năm · Trận giao lưu và thi đấu' END,
   CASE n WHEN 1 THEN 150000 WHEN 2 THEN 180000 ELSE 200000 END,'ACTIVE');
  FOR d IN -7..30 LOOP FOR h IN 12..45 LOOP
   INSERT INTO staff_schedules(id,staff_id,work_date,start_time,end_time,status,version)
   VALUES(pg_temp.demo_id('shift:'||n||':'||d||':'||h),a,CURRENT_DATE+d,(time '00:00'+h*interval '30 minutes')::time,(time '00:00'+(h+1)*interval '30 minutes')::time,'AVAILABLE',0);
  END LOOP;END LOOP;
 END LOOP;
 FOR n IN 1..12 LOOP
  INSERT INTO drinks(id,name,unit,unit_price,stock_quantity,status) VALUES(pg_temp.demo_id('drink:'||n),CASE n WHEN 1 THEN 'Nước suối 500ml' WHEN 2 THEN 'Nước điện giải' ELSE 'Đồ uống demo '||n END,'Chai',10000+n*5000,CASE WHEN n=12 THEN 0 ELSE 80+n END,'ACTIVE');
 END LOOP;
 FOR n IN 1..6 LOOP
  INSERT INTO rental_items(id,name,category,brand,price_per_hour,stock_quantity,status,version) VALUES(pg_temp.demo_id('rental:'||n),'Thiết bị tại quầy '||n,'RACKET','Demo',30000+n*5000,12,'ACTIVE',0);
 END LOOP;
 -- 240 bookings: 180 historical, 60 upcoming, many owned by demo user.
 -- Each uses a unique court/day/interval; leave afternoon/evening free for manual tests.
 FOR n IN 1..240 LOOP
  k:=(n-1)%10+1;d:=CASE WHEN n<=180 THEN -1-((n-1)/10) ELSE 1+((n-181)/10) END;h:=CASE WHEN n<=180 THEN 16 ELSE 20 END;
  c:=pg_temp.demo_id('court:'||k);a:=CASE WHEN n%3<>0 THEN demo ELSE pg_temp.demo_id('user:'||(2+n%27)) END;
  o:=pg_temp.demo_id('order:'||n);b:=pg_temp.demo_id('booking:'||n);
  SELECT base_price INTO total FROM courts WHERE id=c;
  state:=CASE WHEN n<=180 THEN CASE n%6 WHEN 0 THEN 'CANCELLED' WHEN 1 THEN 'EXPIRED' ELSE 'COMPLETED' END ELSE CASE n%4 WHEN 0 THEN 'HOLDING' ELSE 'CONFIRMED' END END;
  paid:=CASE WHEN state IN ('EXPIRED','HOLDING') THEN 0 WHEN state='CANCELLED' THEN total/2 WHEN n%2=0 THEN total ELSE total/2 END;
  INSERT INTO orders(id,customer_account_id,created_by_account_id,customer_name,customer_phone,status,hold_expires_at,subtotal,total_amount,deposit_required,paid_amount,payment_status,created_at,version,metadata)
  SELECT o,a,admin,full_name,phone,state,CASE WHEN state='HOLDING' THEN now()+interval '15 minutes' ELSE (CURRENT_DATE+d+time '07:45')::timestamptz END,total,total,total/2,paid,CASE WHEN paid=0 THEN 'UNPAID' WHEN paid>=total THEN 'PAID' ELSE 'PARTIAL' END,now()-(abs(d)+1)*interval '1 day',0,
    jsonb_build_object('fixture',true,'customerFlow',true,'membershipBenefit',jsonb_build_object('gross',total,'discount',0,'net',total))::text FROM accounts WHERE id=a;
  INSERT INTO bookings(id,order_id,status,check_in_at,check_out_at,created_at) VALUES(b,o,CASE WHEN state='EXPIRED' THEN 'CANCELLED' ELSE state END,CASE WHEN state='COMPLETED' THEN (CURRENT_DATE+d+time '08:00')::timestamptz ELSE NULL END,CASE WHEN state='COMPLETED' THEN (CURRENT_DATE+d+time '09:00')::timestamptz ELSE NULL END,now()-interval '1 day');
  FOR r IN SELECT id FROM court_schedules WHERE court_id=c AND schedule_date=CURRENT_DATE+d AND start_time>=(time '00:00'+h*interval '30 minutes')::time AND start_time<(time '00:00'+(h+2)*interval '30 minutes')::time LOOP
    INSERT INTO booking_slots(id,booking_id,schedule_id,unit_price,released_at) SELECT gen_random_uuid(),b,r,price,CASE WHEN state IN ('CANCELLED','EXPIRED','COMPLETED') THEN now()-interval '1 day' ELSE NULL END FROM court_schedules WHERE id=r;
    UPDATE court_schedules SET status=CASE WHEN state='HOLDING' THEN 'LOCKED' WHEN state='CONFIRMED' THEN 'BOOKED' ELSE 'AVAILABLE' END WHERE id=r;
  END LOOP;
  IF paid>0 THEN
   p:=pg_temp.demo_id('payment:'||n);
   INSERT INTO payments(id,order_id,type,method,amount,transaction_code,status,paid_at,received_by_account_id) VALUES(p,o,CASE WHEN paid<total THEN 'DEPOSIT' ELSE 'BALANCE' END,CASE WHEN n%2=0 THEN 'CASH' ELSE 'BANK_TRANSFER' END,paid,'DEMO-RECEIPT-'||n,'PAID',now()-interval '1 day',admin);
   IF state='CANCELLED' AND n%12=0 THEN
    INSERT INTO refunds(id,payment_id,amount,reason,status,processed_by_account_id,refunded_at) VALUES(pg_temp.demo_id('refund:'||n),p,paid,'Hoàn tiền mẫu','COMPLETED',admin,now());
    UPDATE orders SET paid_amount=0,payment_status='UNPAID' WHERE id=o;
   END IF;
  END IF;
 END LOOP;
 -- Four checked-in orders today for checkout, desk sales and rental-return tests.
 FOR n IN 1..4 LOOP
  c:=pg_temp.demo_id('court:'||n);o:=pg_temp.demo_id('onsite-order:'||n);b:=pg_temp.demo_id('onsite-booking:'||n);
  SELECT base_price INTO total FROM courts WHERE id=c;
  INSERT INTO orders(id,customer_account_id,created_by_account_id,customer_name,customer_phone,status,subtotal,total_amount,deposit_required,paid_amount,payment_status,created_at,version,metadata)
  SELECT o,demo,admin,full_name,phone,'CHECKED_IN',total+35000,total+35000,total/2,total/2,'PARTIAL',now(),0,'{"fixture":true,"customerFlow":true}' FROM accounts WHERE id=demo;
  INSERT INTO bookings(id,order_id,status,check_in_at,created_at) VALUES(b,o,'CHECKED_IN',now(),now());
  FOR r IN SELECT id FROM court_schedules WHERE court_id=c AND schedule_date=CURRENT_DATE AND start_time>='18:00' AND start_time<'19:00' LOOP
   INSERT INTO booking_slots(id,booking_id,schedule_id,unit_price) SELECT gen_random_uuid(),b,r,price FROM court_schedules WHERE id=r;
   UPDATE court_schedules SET status='BOOKED' WHERE id=r;
  END LOOP;
  INSERT INTO payments(id,order_id,type,method,amount,transaction_code,status,paid_at,received_by_account_id) VALUES(pg_temp.demo_id('onsite-payment:'||n),o,'DEPOSIT','CASH',total/2,'DEMO-ONSITE-'||n,'PAID',now(),admin);
  INSERT INTO order_products(id,order_id,booking_id,item_type,rental_item_id,quantity,unit_price,rent_start_at,rent_end_at,issued_at,returned_at,item_condition)
  VALUES(pg_temp.demo_id('onsite-rental:'||n),o,b,'RENTAL',pg_temp.demo_id('rental:1'),1,35000,(CURRENT_DATE+time '18:00')::timestamptz,(CURRENT_DATE+time '19:00')::timestamptz,now(),CASE WHEN n=4 THEN now() ELSE NULL END,'GOOD');
 END LOOP;
 -- Completed and upcoming tournament registrations, enough entrants to draw brackets.
 FOR n IN 1..7 LOOP
  tr:=pg_temp.demo_id('tournament:'||n);day:=CURRENT_DATE+CASE WHEN n<=4 THEN n*4 ELSE -n END;
  INSERT INTO tournaments(id,organizer_account_id,name,format,start_date,end_date,location,registration_fee,registration_deadline,max_participants,status)
  VALUES(tr,admin,CASE n WHEN 1 THEN 'Courtly Singles Open' WHEN 2 THEN 'Courtly Doubles Cup' WHEN 3 THEN 'Courtly Next Singles' WHEN 4 THEN 'Courtly Sunday Doubles' ELSE 'Giải lịch sử demo '||n END,CASE WHEN n%2=1 THEN 'SINGLES' ELSE 'DOUBLES' END,day,day,'Courtly · Khu B',CASE WHEN n%2=1 THEN 200000 ELSE 300000 END,day-2,CASE WHEN n%2=1 THEN 16 ELSE 8 END,CASE WHEN n<=4 THEN 'OPEN' ELSE 'FINISHED' END);
  FOR k IN 2..5 LOOP
   a:=pg_temp.demo_id('user:'||k);r:=pg_temp.demo_id('registration:'||n||':'||k);
   INSERT INTO tournament_registrations(id,tournament_id,account_id,registered_by_account_id,team_name,status,registered_at) VALUES(r,tr,a,admin,'Đội demo '||k,'CONFIRMED',now()-interval '2 days');
   INSERT INTO team_members(id,registration_id,tournament_id,account_id,member_name,email) SELECT pg_temp.demo_id('player:'||n||':'||k),r,tr,a,full_name,email FROM accounts WHERE id=a;
   IF n%2=0 THEN INSERT INTO team_members(id,registration_id,tournament_id,member_name,email) VALUES(pg_temp.demo_id('partner:'||n||':'||k),r,tr,'Đồng đội '||k,'mate'||k||'@courtly.example');END IF;
   INSERT INTO payments(id,registration_id,type,method,amount,transaction_code,status,paid_at,received_by_account_id) VALUES(pg_temp.demo_id('entry-fee:'||n||':'||k),r,'TOURNAMENT_FEE','BANK_TRANSFER',CASE WHEN n%2=1 THEN 200000 ELSE 300000 END,'DEMO-ENTRY-'||n||'-'||k,'PAID',now()-interval '1 day',admin);
  END LOOP;
 END LOOP;
 -- Membership edge cases: demo user starts as Guest so upgrades can be tested.
 FOR n IN 2..8 LOOP
  a:=pg_temp.demo_id('user:'||n);code:=pg_temp.demo_id('membership:'||n)::text;
  INSERT INTO app_documents(document_key,data,version) VALUES('membership:'||code,jsonb_build_object('id',code,'accountId',a,'name','Khách demo '||n,'planId',CASE WHEN n%2=0 THEN 'club' ELSE 'plus' END,'planName',CASE WHEN n%2=0 THEN 'Club' ELSE 'Plus' END,'price',CASE WHEN n%2=0 THEN 299000 ELSE 599000 END,'days',30,'discountPercent',CASE WHEN n%2=0 THEN 10 ELSE 15 END,'vipDiscountPercent',CASE WHEN n%2=0 THEN 5 ELSE 10 END,'advanceDays',CASE WHEN n%2=0 THEN 14 ELSE 21 END,'freeChanges',CASE WHEN n%2=0 THEN 1 ELSE 2 END,'status',CASE WHEN n=7 THEN 'PENDING' WHEN n=8 THEN 'CANCELLED' ELSE 'ACTIVE' END,'startsAt',now()-interval '10 days','endsAt',CASE WHEN n=6 THEN now()-interval '1 day' ELSE now()+interval '20 days' END,'createdAt',now()-interval '10 days')::text,0);
 END LOOP;
 -- Activated memberships have matching receipts, including the expired example.
 FOR n IN 2..6 LOOP
  code:=pg_temp.demo_id('membership:'||n)::text;p:=pg_temp.demo_id('membership-payment:'||n);
  INSERT INTO app_documents(document_key,data,version) VALUES('membership-payment:'||p,jsonb_build_object('id',p,'membershipId',code,'accountId',pg_temp.demo_id('user:'||n),'planName',CASE WHEN n%2=0 THEN 'Club' ELSE 'Plus' END,'amount',CASE WHEN n%2=0 THEN 299000 ELSE 599000 END,'method','BANK_TRANSFER','transactionCode','DEMO-MEMBER-'||n,'createdAt',now()-interval '10 days')::text,0);
  UPDATE app_documents SET data=(data::jsonb||jsonb_build_object('paymentId',p))::text WHERE document_key='membership:'||code;
 END LOOP;
 FOR n IN 1..9 LOOP
  code:=pg_temp.demo_id('feedback:'||n)::text;
  INSERT INTO app_documents(document_key,data,version) VALUES('feedback:'||code,jsonb_build_object('id',code,'accountId',pg_temp.demo_id('user:'||(n+1)),'displayName','Khách demo '||n,'rating',1+n%5,'topic','COURT','message','Sân thoáng, lịch đặt rõ ràng. Đây là phản hồi mẫu để kiểm tra giao diện.','publishConsent',n%3<>0,'status',CASE WHEN n%3=0 THEN 'PRIVATE' WHEN n%3=1 THEN 'PUBLISHED' ELSE 'PENDING' END,'createdAt',now()-interval '2 days','reply','')::text,0);
 END LOOP;
 -- Staff allocation on three upcoming orders, one referee per concurrent court.
 FOR n IN 181..183 LOOP
  k:=n-180;o:=pg_temp.demo_id('order:'||n);b:=pg_temp.demo_id('booking:'||n);r:=pg_temp.demo_id('shift:'||k||':1:20');
  SELECT hourly_rate INTO rate FROM staff WHERE id=pg_temp.demo_id('staff:'||k);
  INSERT INTO booking_staff(id,booking_id,staff_schedule_id,court_schedule_id,unit_price) VALUES(pg_temp.demo_id('assignment:'||n),b,r,pg_temp.demo_id('slot:'||k||':1:20'),rate);
  UPDATE staff_schedules SET status='BOOKED' WHERE id=r;
  UPDATE orders SET subtotal=subtotal+rate/2,total_amount=total_amount+rate/2,payment_status='PARTIAL' WHERE id=o;
 END LOOP;
 FOR n IN 2..20 LOOP
  IF n%6 NOT IN (0,1) THEN
   o:=pg_temp.demo_id('order:'||n);b:=pg_temp.demo_id('booking:'||n);
   INSERT INTO order_products(id,order_id,booking_id,item_type,drink_id,quantity,unit_price)
   VALUES(pg_temp.demo_id('product:'||n),o,b,'DRINK',pg_temp.demo_id('drink:1'),2,15000);
   UPDATE orders SET subtotal=subtotal+30000,total_amount=total_amount+30000,payment_status='PARTIAL' WHERE id=o;
  END IF;
 END LOOP;
 FOR n IN 5..7 LOOP
  tr:=pg_temp.demo_id('tournament:'||n);
  FOR k IN 0..1 LOOP
   INSERT INTO matches(id,tournament_id,registration1_id,registration2_id,winner_registration_id,round_number,bracket_index,round_name,score,status)
   VALUES(pg_temp.demo_id('match:'||n||':'||k),tr,pg_temp.demo_id('registration:'||n||':'||(2+k*2)),pg_temp.demo_id('registration:'||n||':'||(3+k*2)),pg_temp.demo_id('registration:'||n||':'||(2+k*2)),1,k,'Bán kết','6-3','FINISHED');
  END LOOP;
  INSERT INTO matches(id,tournament_id,registration1_id,registration2_id,winner_registration_id,round_number,bracket_index,round_name,score,status)
  VALUES(pg_temp.demo_id('match:'||n||':final'),tr,pg_temp.demo_id('registration:'||n||':2'),pg_temp.demo_id('registration:'||n||':4'),pg_temp.demo_id('registration:'||n||':2'),2,0,'Chung kết','7-6','FINISHED');
 END LOOP;
 INSERT INTO app_documents(document_key,data,version) VALUES('fixture:handoff-v1',jsonb_build_object('createdAt',now(),'date',CURRENT_DATE,'orders',244,'demoEmail','minh.anh@example.com')::text,0);
END $$;
INSERT INTO app_documents(document_key,data,version) VALUES ('club', '{"name": "Courtly · Tennis Club", "tagline": "Tennis bắt đầu từ một cuộc hẹn.", "intro": "Khám phá giờ trống, chủ động lịch chơi và kết nối qua những giải đấu. Courtly giúp bạn chuẩn bị cho buổi tennis tiếp theo ngay từ khi chọn sân.", "story": "Một lịch chơi rõ ràng để bạn tập trung vào trận đấu. Tại Courtly, bạn có thể xem sân, giá và giờ trống trước khi đặt; theo dõi lịch hẹn và tìm hiểu các giải đấu trong cùng một không gian.", "mission": "Đặt trải nghiệm của người chơi ở trung tâm: thông tin dễ tìm, lựa chọn rõ ràng và phản hồi luôn có nơi tiếp nhận.", "address": "DEMO · 128 Đường Tennis, Khu thể thao Courtly, TP.HCM", "phone": "0900 000 000 (DEMO)", "email": "hello@courtly.example", "openingHours": "06:00 – 23:00 · Mỗi ngày", "mapUrl": "", "socialUrl": "", "paymentInstructions": "Dùng thanh toán sandbox trong môi trường thử nghiệm. Tiền thật chỉ được xác nhận qua ngân hàng hoặc quầy."}',0) ON CONFLICT(document_key) DO NOTHING;
INSERT INTO app_documents(document_key,data,version) VALUES ('article:choose-your-court', '{"id": "choose-your-court", "title": "Khu A, B hay V: đâu là sân dành cho bạn?", "excerpt": "Ngoài trời, trong nhà hay không gian riêng tư: bắt đầu từ cách bạn muốn tận hưởng buổi chơi.", "body": "Một cuộc chơi, nhiều lựa chọn\nKhu A là lựa chọn cho người thích không khí ngoài trời. Khu B có mái che, phù hợp khi bạn muốn một không gian chơi trong nhà. Khu V hướng đến trải nghiệm riêng tư hơn. Ảnh trong bài chỉ minh họa định hướng không gian của từng khu.\n\nXem vị trí trước khi chọn\nMở bản đồ ở mục Đặt sân để nhìn rõ vị trí A01–A04, B01–B04 và V01–V02. Chọn sân trước, sau đó chọn ngày và giờ chơi. Lịch trống được cập nhật theo khung giờ bạn chọn trong bản mẫu.\n\nBiết chi phí trước khi ra sân\nGiá mẫu theo giờ là 200.000đ tại khu A, 300.000đ tại khu B và 500.000đ tại khu V. Tổng phí phụ thuộc thời lượng và ưu đãi hội viên. Bạn luôn có thể xem lại số tiền trước bước thanh toán.", "category": "NEWS", "status": "PUBLISHED", "source": "EDITORIAL", "imageUrl": "/guest/zone-b-indoor.webp", "publishedAt": "2026-10-19T00:00:00Z"}',0) ON CONFLICT(document_key) DO NOTHING;
INSERT INTO app_documents(document_key,data,version) VALUES ('article:plan-your-session', '{"id": "plan-your-session", "title": "Một buổi chơi chủ động, từ giờ đầu tiên", "excerpt": "Chọn giờ theo bước 30 phút, thêm trọng tài khi cần và kiểm tra chi phí trước khi xác nhận.", "body": "Bắt đầu rồi kết thúc\nỞ mục Đặt sân, nhấn giờ bắt đầu trước rồi nhấn giờ kết thúc. Mỗi bước cách nhau 30 phút. Bạn có thể chọn nhiều khoảng liên tiếp, miễn toàn bộ khoảng chơi còn trống.\n\nTrọng tài theo lịch của bạn\nBạn không nhất thiết phải thuê trọng tài cho cả buổi. Chọn khoảng giờ cần hỗ trợ trong thời gian đặt sân, xem hồ sơ còn trống và chọn người phù hợp. Phí trọng tài được tách riêng khỏi tiền sân.\n\nDành một phút kiểm tra đơn\nTrước khi tiếp tục, kiểm tra mã sân, ngày chơi, giờ bắt đầu và kết thúc. Màn hình thanh toán tách rõ tổng phí, cọc và phần còn lại. Các bước thanh toán trong bản demo chỉ mô phỏng trải nghiệm.", "category": "NEWS", "status": "PUBLISHED", "source": "EDITORIAL", "imageUrl": "/guest/zone-b-indoor.webp", "publishedAt": "2026-10-19T00:00:00Z"}',0) ON CONFLICT(document_key) DO NOTHING;
INSERT INTO app_documents(document_key,data,version) VALUES ('article:find-your-partner', '{"id": "find-your-partner", "title": "Có đồng đội, thêm lý do để ra sân", "excerpt": "Một lời hẹn sau giờ làm, một trận giao hữu cuối tuần hay lần đầu cùng nhau đăng ký giải đôi.", "body": "Bắt đầu bằng một cuộc hẹn nhỏ\nKhông cần chờ một dịp đặc biệt để ra sân. Cùng thống nhất thời gian, mức độ thi đấu và điều cả hai mong muốn ở buổi chơi: luyện tập, giao lưu hay thử sức trong một trận đấu có tính điểm.\n\nThống nhất trước khi đăng ký\nNếu muốn thử giải đôi, hãy đọc kỹ lịch, điều lệ và lệ phí của đúng giải đang chọn. Chuẩn bị tên đội, họ tên và email của cả hai thành viên. Mỗi người chỉ thuộc một đội trong cùng giải đôi của bản mẫu.\n\nLuôn có một trận tiếp theo\nLịch giải không chỉ có một lần hẹn cố định. Theo dõi danh sách giải để xem những ngày thi đấu tiếp theo, thể thức và hạn đăng ký riêng. Các sự kiện trong bản demo là lịch đề xuất để trải nghiệm giao diện.", "category": "NEWS", "status": "PUBLISHED", "source": "EDITORIAL", "imageUrl": "/guest/zone-b-indoor.webp", "publishedAt": "2026-10-19T00:00:00Z"}',0) ON CONFLICT(document_key) DO NOTHING;
COMMIT;
