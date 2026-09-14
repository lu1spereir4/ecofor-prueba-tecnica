# API y persistencia

Complemento del [README principal](../README.md): consultas y decisiones exigidas en los puntos 2.3 y 2.4.

Express aplica `requireJson → express-validator → controlador → repositorio`. Las rutas `/orders` y `/reports` tienen alias bajo `/api`. Respuestas JSON, IDs numéricos y montos como strings de dos decimales: 201 al crear, 200 al consultar, 400 por validación, 404 por entidad ausente y 409 por stock insuficiente. Se rechazan cuerpos mayores a 1 MB (413) y tipos no JSON (415); un bloqueo agotado devuelve 503 y revierte la transacción.

## Migración de channel

Sobre una instalación en versión 002, desplegar primero código compatible con ambos esquemas y ejecutar desde la raíz:

```powershell
npm.cmd --prefix backend run migrate -- --through=003_orders_channel.sql
```

El runner ejecuta este SQL en una transacción corta y registra la versión:

```sql
SET LOCAL lock_timeout = '100ms';
SET LOCAL statement_timeout = '3s';
LOCK TABLE sales.orders IN ACCESS EXCLUSIVE MODE NOWAIT;
ALTER TABLE sales.orders ADD COLUMN channel TEXT NOT NULL DEFAULT 'web';
```

PostgreSQL 15 guarda el default constante en metadatos: las filas existentes leen `web` sin un UPDATE masivo ni reescritura. El lock exclusivo sigue siendo necesario; `NOWAIT` evita esperar detrás de consultas largas y bloquear una cola de lectores. Ante `55P03`, el runner revierte y reintenta hasta siete veces con espera fuera de la transacción. Si se agotan, se puede repetir el comando. [Referencia de PostgreSQL](https://www.postgresql.org/docs/15/sql-altertable.html).

Se probó el comportamiento con lectores/escritores y sin reescritura; no con 50 millones de filas reales. Las migraciones 004/005 son de instalación inicial y no tienen esta garantía online.

## POST /orders

Payload: `{ "customer_id": 1, "items": [{ "product_id": 7, "quantity": 3 }] }`. Devuelve `{ data: pedido }` con sus ítems. Las cantidades repetidas de un producto se suman al validar stock.

Se bloquea el cliente para impedir su eliminación y los productos en orden de ID para evitar deadlocks. Stock, pedido e ítems se confirman juntos. Esto funciona entre procesos Express; un mutex en memoria no serviría. `unnest` y `jsonb_to_recordset` permiten escrituras por lote, tomando el precio vigente del producto bloqueado.

```sql
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '15s';
SELECT email FROM sales.customers WHERE id = $1 FOR KEY SHARE;
SELECT id, stock FROM sales.products
WHERE id = ANY($1::integer[]) ORDER BY id FOR UPDATE;
UPDATE sales.products p SET stock = p.stock - requested.quantity
FROM unnest($1::integer[], $2::integer[]) AS requested(id, quantity)
WHERE p.id = requested.id AND p.stock >= requested.quantity RETURNING p.id;
INSERT INTO sales.orders (order_ref, customer_email, customer_key, status, created_at)
VALUES ($1, $2, $2, 'pending', clock_timestamp()) RETURNING id, order_ref;
INSERT INTO sales.order_items (order_ref, order_key, sku, quantity, unit_price)
SELECT $1, $1, p.sku, requested.quantity, p.price
FROM jsonb_to_recordset($2::jsonb) AS requested(product_id integer, quantity integer)
JOIN sales.products p ON p.id = requested.product_id;
-- SELECT de detalle de la siguiente sección, en la misma conexión/transacción.
COMMIT;
-- Si falla: ROLLBACK en lugar de COMMIT.
```

Los parámetros se numeran por sentencia. El pedido usa referencia `WEB-UUID`; estado `pending` y fecha del instante de inserción. Un POST repetido crea otro pedido: la idempotencia corresponde a la ingesta CSV.

## GET /orders

Filtros opcionales: `status`, `customer` parcial sin distinguir mayúsculas, `from` y `to` inclusivos; además `customer_email` y `order_ref` exactos. Las fechas solas significan medianoche UTC; para incluir todo el día final, usar `23:59:59.999999Z`.

`limit` vale 20 por defecto, máximo 100. Devuelve `{ data, nextCursor, page_size, has_more }`. El cursor base64url contiene fecha con microsegundos e ID; se reutiliza con los mismos filtros. Cambiar filtros reinicia la paginación.

```sql
WITH page AS MATERIALIZED (
  SELECT o.id, o.order_ref, o.customer_email, o.customer_key, o.status, o.created_at, o.channel
  FROM sales.orders o
  -- WHERE: condiciones presentes unidas con AND
  ORDER BY o.created_at DESC, o.id DESC LIMIT $n
)
SELECT p.id, p.order_ref, p.customer_email, p.status, p.channel, c.id AS customer_id,
  to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at,
  c.full_name AS customer_name, c.city, (p.customer_key IS NOT NULL) AS customer_linked,
  round(COALESCE(amount.total, 0), 2)::text AS total, amount.item_count::integer
FROM page p LEFT JOIN sales.customers c ON c.email = p.customer_key
CROSS JOIN LATERAL (
  SELECT sum(i.quantity * i.unit_price) AS total, count(*) AS item_count
  FROM sales.order_items i WHERE i.order_ref = p.order_ref
) amount
ORDER BY p.created_at DESC, p.id DESC;
```

El WHERE incluye solo las condiciones presentes, unidas con AND y parámetros consecutivos:

- `o.status = $n`
- `o.customer_key IN (SELECT email FROM sales.customers WHERE full_name ILIKE $n)`
- `o.customer_email = $n` y `o.order_ref = $n`
- `o.created_at >= $n::timestamptz` y `o.created_at <= $n::timestamptz`
- `(o.created_at, o.id) < ($n::timestamptz, $n_plus_1::integer)`

El último parámetro es limit + 1. El patrón de cliente es `%texto%`, escapando `%`, `_` y barra inversa. Se pagina antes de sumar ítems, evitando agregar millones de líneas por petición. El ID desempata fechas iguales; el seek evita el costo creciente de OFFSET. No se calcula COUNT global ni se almacena un total redundante. LEFT JOIN conserva pedidos sin ficha y COALESCE devuelve cero si no tienen ítems.

## GET /orders/:id

Consulta única por ID: devuelve `{ data: pedido }` con cliente e ítems, o 404. El agregado JSON evita N+1 y mantiene total y líneas en el mismo snapshot. Usa precios históricos, conserva líneas repetidas y devuelve `customer: null` cuando el CSV contiene un email sin ficha. No se pagina el detalle.

```sql
SELECT o.id, o.order_ref, o.customer_email, o.status, o.channel, c.id AS customer_id,
    to_char(o.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at,
    c.full_name AS customer_name, c.city, (o.customer_key IS NOT NULL) AS customer_linked,
    CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id', c.id, 'email', c.email,
      'full_name', c.full_name, 'city', c.city) END AS customer,
    round(COALESCE(lines.total, 0), 2)::text AS total, COALESCE(lines.items, '[]'::jsonb) AS items
  FROM sales.orders o LEFT JOIN sales.customers c ON c.email = o.customer_key
  CROSS JOIN LATERAL (
    SELECT sum(i.quantity * i.unit_price) AS total,
      jsonb_agg(jsonb_build_object('id', i.id, 'source_row', i.source_row::text, 'product_id', p.id,
        'sku', i.sku, 'name', p.name, 'quantity', i.quantity, 'unit_price', round(i.unit_price, 2)::text,
        'amount', round(i.quantity * i.unit_price, 2)::text,
        'subtotal', round(i.quantity * i.unit_price, 2)::text) ORDER BY i.id) AS items
    FROM sales.order_items i JOIN sales.products p ON p.sku = i.sku
    WHERE i.order_ref = o.order_ref
  ) lines
  WHERE o.id = $1;
```

## GET /reports/top-customers

`as_of` es opcional; por defecto, medianoche de la fecha UTC actual. La ventana es `[as_of - 720 horas, as_of)`. Se excluyen cancelados y pedidos sin cliente resuelto. Se suma primero por pedido y luego por cliente para que el join de ítems no infle el conteo. Ticket promedio = monto / pedidos; los pedidos sin ítems cuentan con monto cero.

Devuelve `{ as_of, data }` con customer_id, full_name, total_amount, order_count y average_ticket. El top 10 se ordena por monto numérico e ID en empates, sin paginación. No se usa AVG de precios ni precios actuales del catálogo.

```sql
WITH recent_orders AS MATERIALIZED (
  SELECT o.order_ref, o.customer_key
  FROM sales.orders o
  WHERE o.created_at >= $1::timestamptz - interval '720 hours'
    AND o.created_at < $1::timestamptz AND o.status <> 'cancelled'
    AND o.customer_key IS NOT NULL
), order_totals AS (
  SELECT o.order_ref, o.customer_key, COALESCE(sum(i.quantity * i.unit_price), 0) AS amount
  FROM recent_orders o LEFT JOIN sales.order_items i ON i.order_ref = o.order_ref
  GROUP BY o.order_ref, o.customer_key
), ranked AS (
  SELECT customer_key, sum(amount) AS amount, count(*)::integer AS order_count
  FROM order_totals GROUP BY customer_key
)
SELECT c.id AS customer_id, c.full_name, round(r.amount, 2)::text AS total_amount,
  r.order_count, round(r.amount / r.order_count, 2)::text AS average_ticket
FROM ranked r JOIN sales.customers c ON c.email = r.customer_key
ORDER BY r.amount DESC, c.id ASC LIMIT 10;
```

## POST /orders/:id/apply-discounts

Payload `{ coupons: [...] }`, máximo 30 sin truncar; más de 30 da 400 y pedidos con más de 100 ítems dan 422. Solo se lee el pedido: el cálculo no modifica stock, precios ni estado.

```sql
SELECT o.id, COALESCE(lines.items, '[]'::jsonb) AS items
  FROM sales.orders o
  CROSS JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('id', i.id, 'product_id', p.id, 'sku', i.sku,
      'quantity', i.quantity, 'unit_price', round(i.unit_price, 2)::text) ORDER BY i.id) AS items
    FROM sales.order_items i JOIN sales.products p ON p.sku = i.sku
    WHERE i.order_ref = o.order_ref
  ) lines WHERE o.id = $1;
```

La lectura única conserva un snapshot de líneas y precios históricos. El servicio calcula en centavos con BigInt:

- Mínimos y elegibilidad se evalúan sobre el original; cada cupón calcula su descuento independientemente.
- Porcentajes y montos fijos se distribuyen proporcionalmente. Se redondea al centavo, mitad hacia arriba, y los restos se asignan por resto mayor e ID.
- `n_for_m` agrupa unidades del SKU entre líneas. Si tienen precios distintos, regala las más baratas.
- Se suman descuentos por ítem con tope en su monto, sin redistribuir el exceso ni aplicar descuentos secuenciales.
- Basta comparar todos los acumulables contra cada exclusivo: añadir descuentos no negativos nunca reduce el total. Se evita explorar 2^30 combinaciones; el costo es O(cupones × ítems × log ítems).
- Se omiten descuentos cero. En empate gana el conjunto acumulable; entre exclusivos, el primero del payload.

Devuelve order_id, subtotal, applied_coupons, total_discount, total e items con su descuento y monto final. Los códigos por ítem indican aportes positivos antes del tope compartido.

## Índices

DDL de referencia; las migraciones ya los crean. Los de fecha/ref pertenecen a la versión inicial, y los de fecha/ID al cursor actual.

```sql
CREATE INDEX orders_created_ref_idx ON sales.orders (created_at DESC, order_ref DESC);
CREATE INDEX orders_status_created_ref_idx ON sales.orders (status, created_at DESC, order_ref DESC);
CREATE INDEX orders_customer_created_ref_idx ON sales.orders (customer_email, created_at DESC, order_ref DESC);
CREATE INDEX order_items_order_row_idx ON sales.order_items (order_ref, source_row) INCLUDE (quantity, unit_price);
CREATE INDEX order_items_sku_idx ON sales.order_items (sku);
CREATE INDEX orders_customer_key_idx ON sales.orders (customer_key);
CREATE INDEX order_items_order_key_idx ON sales.order_items (order_key);
CREATE INDEX customer_source_email_idx ON sales.customer_source_rows (email);
CREATE INDEX product_source_sku_idx ON sales.product_source_rows (sku);
```

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX orders_created_id_idx ON sales.orders (created_at DESC, id DESC);
CREATE INDEX orders_status_created_id_idx ON sales.orders (status, created_at DESC, id DESC);
CREATE INDEX orders_customer_created_id_idx ON sales.orders (customer_key, created_at DESC, id DESC);
CREATE INDEX customers_full_name_trgm_idx ON sales.customers USING gin (full_name gin_trgm_ops);
```

- `orders_created_id_idx` y `orders_status_created_id_idx`: orden/rango/cursor, anteponiendo igualdad de estado. Un índice solo de estado sería poco selectivo.
- `orders_customer_created_id_idx`: pedidos de clientes resueltos y su FK. `orders_customer_created_ref_idx`: búsqueda por email original, incluso sin ficha.
- `orders_created_ref_idx` y `orders_status_created_ref_idx`: orden y filtros de la versión inicial. Son redundantes con el cursor nuevo; retirarlos requiere revisar consumidores anteriores. `orders_customer_key_idx` también está cubierto por el compuesto nuevo. Mantenerlos cuesta espacio y escrituras.
- `order_items_order_row_idx`: ubica líneas y aporta cantidad/precio al agregado; INCLUDE permite evitar lecturas de heap si el mapa de visibilidad lo permite. El detalle actual ordena esas líneas por ID.
- `order_items_sku_idx`, `order_items_order_key_idx`, `orders_customer_key_idx`: verificaciones de FK al modificar padres; PostgreSQL no indexa automáticamente el lado hijo.
- `customer_source_email_idx` y `product_source_sku_idx`: localizar apariciones fuente y verificar sus FK.
- `customers_full_name_trgm_idx`: búsqueda ILIKE parcial; un B-tree no resuelve `%nombre%`. El plan depende de la selectividad.

Las PK/UNIQUE generan además estos índices:

```sql
CREATE UNIQUE INDEX products_pkey ON public.products (id);
CREATE UNIQUE INDEX products_codigo_key ON public.products (codigo);
CREATE UNIQUE INDEX schema_migrations_pkey ON public.schema_migrations (version);
CREATE UNIQUE INDEX customers_pkey ON sales.customers (email);
CREATE UNIQUE INDEX products_pkey ON sales.products (sku);
CREATE UNIQUE INDEX orders_pkey ON sales.orders (order_ref);
CREATE UNIQUE INDEX order_items_pkey ON sales.order_items (id);
CREATE UNIQUE INDEX order_items_source_row_key ON sales.order_items (source_row);
CREATE UNIQUE INDEX customers_id_key ON sales.customers (id);
CREATE UNIQUE INDEX products_id_key ON sales.products (id);
CREATE UNIQUE INDEX orders_id_key ON sales.orders (id);
CREATE UNIQUE INDEX customer_source_rows_pkey ON sales.customer_source_rows (source_row);
CREATE UNIQUE INDEX product_source_rows_pkey ON sales.product_source_rows (source_row);
```

Las claves naturales soportan referencias CSV y UPSERT; los IDs, búsquedas HTTP. Los ordinales únicos conservan líneas repetidas y permiten NULL para ítems HTTP. La PK de schema_migrations impide repetir versiones. Se crean durante la instalación; índices futuros sobre tablas en servicio deben usar CREATE INDEX CONCURRENTLY fuera del runner transaccional. No se agregan índices para todas las combinaciones ni para channel por costo de escritura y falta de consultas que los necesiten.

## Rutas auxiliares

`GET /api/customers` y `GET /api/catalog/products` aceptan search, limit (20/100) y after (email/SKU). Usan seek, limit + 1 y búsqueda literal ILIKE por nombre/email o nombre/SKU. El código está en [order.repository.ts](src/repositories/order.repository.ts). El PATCH de estado usa `WHERE id=$2 AND status=$3` para detectar conflictos (409); no restituye stock. El inventario previo usa [product.repository.ts](src/repositories/product.repository.ts).

Para probar HTTP manualmente, importar la [colección Postman](postman/ECOFOR.postman_collection.json). La preparación y el comando completo de pruebas están en el README principal.
