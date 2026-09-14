-- El CSV real contiene claves repetidas y referencias ausentes.
-- Referencia original obligatoria + vínculo opcional y verificable por FK.
ALTER TABLE sales.orders DROP CONSTRAINT orders_customer_email_fkey;
ALTER TABLE sales.orders ADD COLUMN customer_key TEXT REFERENCES sales.customers(email);
UPDATE sales.orders SET customer_key = customer_email;
ALTER TABLE sales.orders ADD CHECK (customer_key IS NULL OR customer_key = customer_email);

ALTER TABLE sales.order_items DROP CONSTRAINT order_items_order_ref_fkey;
ALTER TABLE sales.order_items ADD COLUMN order_key TEXT REFERENCES sales.orders(order_ref);
UPDATE sales.order_items SET order_key = order_ref;
ALTER TABLE sales.order_items ADD CHECK (order_key IS NULL OR order_key = order_ref);

-- Copias tipadas de TODAS las filas fuente, incluidas las repetidas.
CREATE TABLE sales.customer_source_rows (
  source_row BIGINT PRIMARY KEY CHECK (source_row > 0),
  email TEXT NOT NULL REFERENCES sales.customers(email),
  full_name TEXT NOT NULL,
  city TEXT NOT NULL
);
CREATE TABLE sales.product_source_rows (
  source_row BIGINT PRIMARY KEY CHECK (source_row > 0),
  sku TEXT NOT NULL REFERENCES sales.products(sku),
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  stock INTEGER NOT NULL
);
CREATE INDEX orders_customer_key_idx ON sales.orders (customer_key);
CREATE INDEX order_items_order_key_idx ON sales.order_items (order_key);
CREATE INDEX customer_source_email_idx ON sales.customer_source_rows (email);
CREATE INDEX product_source_sku_idx ON sales.product_source_rows (sku);
