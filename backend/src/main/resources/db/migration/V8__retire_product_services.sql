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
