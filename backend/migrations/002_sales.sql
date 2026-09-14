CREATE SCHEMA sales;

CREATE TABLE sales.customers (
  email TEXT PRIMARY KEY CHECK (btrim(email) <> ''),
  full_name TEXT NOT NULL CHECK (btrim(full_name) <> ''),
  city TEXT NOT NULL CHECK (btrim(city) <> '')
);

CREATE TABLE sales.products (
  sku TEXT PRIMARY KEY CHECK (btrim(sku) <> ''),
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  price NUMERIC NOT NULL CHECK (price >= 0 AND price < 'Infinity'::numeric AND scale(price) <= 2),
  stock INTEGER NOT NULL CHECK (stock >= 0)
);

CREATE TABLE sales.orders (
  order_ref TEXT PRIMARY KEY CHECK (btrim(order_ref) <> ''),
  customer_email TEXT NOT NULL REFERENCES sales.customers(email),
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'shipped', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL CHECK (isfinite(created_at))
);

CREATE TABLE sales.order_items (
  -- Ordinal del registro CSV (sin cabecera), no número de línea física.
  source_row BIGINT PRIMARY KEY CHECK (source_row > 0),
  order_ref TEXT NOT NULL REFERENCES sales.orders(order_ref),
  sku TEXT NOT NULL REFERENCES sales.products(sku),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0 AND unit_price < 'Infinity'::numeric AND scale(unit_price) <= 2)
);

-- Se crean junto con las tablas vacías, antes de admitir tráfico.
CREATE INDEX orders_created_ref_idx ON sales.orders (created_at DESC, order_ref DESC);
CREATE INDEX orders_status_created_ref_idx ON sales.orders (status, created_at DESC, order_ref DESC);
CREATE INDEX orders_customer_created_ref_idx ON sales.orders (customer_email, created_at DESC, order_ref DESC);
CREATE INDEX order_items_order_row_idx ON sales.order_items (order_ref, source_row) INCLUDE (quantity, unit_price);
CREATE INDEX order_items_sku_idx ON sales.order_items (sku);
