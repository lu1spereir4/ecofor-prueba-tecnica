-- Evolución para la API: IDs numéricos sin eliminar claves naturales ni datos.
-- Preparación de esta fase; no es la migración online de channel.
SET LOCAL statement_timeout = '180s';
ALTER TABLE sales.customers ADD COLUMN id INTEGER GENERATED ALWAYS AS IDENTITY;
ALTER TABLE sales.customers ADD CONSTRAINT customers_id_key UNIQUE (id);
ALTER TABLE sales.products ADD COLUMN id INTEGER GENERATED ALWAYS AS IDENTITY;
ALTER TABLE sales.products ADD CONSTRAINT products_id_key UNIQUE (id);
ALTER TABLE sales.orders ADD COLUMN id INTEGER GENERATED ALWAYS AS IDENTITY;
ALTER TABLE sales.orders ADD CONSTRAINT orders_id_key UNIQUE (id);

ALTER TABLE sales.order_items ADD COLUMN id INTEGER GENERATED ALWAYS AS IDENTITY;
ALTER TABLE sales.order_items DROP CONSTRAINT order_items_pkey;
ALTER TABLE sales.order_items ADD PRIMARY KEY (id);
ALTER TABLE sales.order_items ALTER COLUMN source_row DROP NOT NULL;
ALTER TABLE sales.order_items ADD CONSTRAINT order_items_source_row_key UNIQUE (source_row);
-- source_row NULL identifica líneas creadas por HTTP; no se inventa un ordinal CSV.

CREATE INDEX orders_created_id_idx ON sales.orders (created_at DESC, id DESC);
CREATE INDEX orders_status_created_id_idx ON sales.orders (status, created_at DESC, id DESC);
CREATE INDEX orders_customer_created_id_idx ON sales.orders (customer_key, created_at DESC, id DESC);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX customers_full_name_trgm_idx ON sales.customers USING gin (full_name gin_trgm_ops);
