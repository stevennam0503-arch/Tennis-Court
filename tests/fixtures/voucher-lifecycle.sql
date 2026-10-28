-- Disposable test database only; apply once before voucher-lifecycle-api.mjs.
BEGIN;
DO $$ BEGIN
 IF current_setting('courtly.allow_test_data', true) IS DISTINCT FROM 'on' THEN
  RAISE EXCEPTION 'Requires courtly.allow_test_data=on on a disposable database';
 END IF;
END $$;
INSERT INTO vouchers(code,type,value,min_order,usage_limit,per_user_limit,description) VALUES
 ('REG-PLAYED','FIXED',50000,100000,1,1,'Regression: retain consumed benefit'),
 ('REG-RETURNED','FIXED',50000,150000,1,1,'Regression: validate a restored voucher'),
 ('REG-PERCENT','PERCENT',25,100000,5,1,'Regression: percentage preview and restore');
COMMIT;
