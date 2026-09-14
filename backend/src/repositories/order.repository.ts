import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from '../db';
import { HttpError } from '../middleware/errors';
import type { OrderCursor } from '../utils/order-cursor';
export type { OrderCursor } from '../utils/order-cursor';

export const statuses = ['pending', 'paid', 'shipped', 'cancelled'] as const;
export type OrderStatus = (typeof statuses)[number];
export interface OrderFilters {
  limit: number;
  status?: string;
  customer?: string;
  customerEmail?: string;
  orderRef?: string;
  from?: string;
  to?: string;
  cursor?: OrderCursor;
}
export interface NewOrderItem {
  product_id: number;
  quantity: number;
}
export interface OrderItem {
  id: number;
  source_row: string | null;
  product_id: number;
  sku: string;
  name: string;
  quantity: number;
  unit_price: string;
  amount: string;
  subtotal: string;
}
export interface OrderDetail {
  id: number;
  order_ref: string;
  customer_id: number | null;
  customer_email: string;
  customer_name: string | null;
  city: string | null;
  customer_linked: boolean;
  customer: { id: number; email: string; full_name: string; city: string } | null;
  status: OrderStatus;
  created_at: string;
  channel: string;
  total: string;
  items: OrderItem[];
}

export function buildOrdersQuery(filters: OrderFilters) {
  const values: unknown[] = [];
  const conditions: string[] = [];
  const bind = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };
  if (filters.status) conditions.push(`o.status = ${bind(filters.status)}`);
  if (filters.customer) {
    const pattern = `%${filters.customer.replace(/[\\%_]/g, '\\$&')}%`;
    conditions.push(
      `o.customer_key IN (SELECT email FROM sales.customers WHERE full_name ILIKE ${bind(pattern)})`,
    );
  }
  if (filters.customerEmail) conditions.push(`o.customer_email = ${bind(filters.customerEmail)}`);
  if (filters.orderRef) conditions.push(`o.order_ref = ${bind(filters.orderRef)}`);
  if (filters.from) conditions.push(`o.created_at >= ${bind(filters.from)}::timestamptz`);
  if (filters.to) conditions.push(`o.created_at <= ${bind(filters.to)}::timestamptz`);
  if (filters.cursor)
    conditions.push(
      `(o.created_at, o.id) < (${bind(filters.cursor.created_at)}::timestamptz, ${bind(filters.cursor.id)}::integer)`,
    );
  const limit = bind(filters.limit + 1);
  return {
    text: `WITH page AS MATERIALIZED (
      SELECT o.id, o.order_ref, o.customer_email, o.customer_key, o.status, o.created_at, o.channel
      FROM sales.orders o ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY o.created_at DESC, o.id DESC LIMIT ${limit}
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
    ORDER BY p.created_at DESC, p.id DESC`,
    values,
  };
}

export async function findOrders(filters: OrderFilters) {
  const result = await pool.query(buildOrdersQuery(filters));
  const hasMore = result.rows.length > filters.limit;
  const data = result.rows.slice(0, filters.limit);
  const last = data.at(-1);
  const nextCursor =
    hasMore && last
      ? Buffer.from(JSON.stringify({ created_at: last.created_at, id: last.id })).toString(
          'base64url',
        )
      : null;
  return { data, nextCursor, page_size: filters.limit, has_more: hasMore };
}

export const ORDER_DETAIL_SQL = `
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
  WHERE o.id = $1`;

export async function findOrder(
  id: number,
  client: Pick<PoolClient, 'query'> = pool,
): Promise<OrderDetail | null> {
  return (await client.query<OrderDetail>(ORDER_DETAIL_SQL, [id])).rows[0] ?? null;
}

export async function createOrder(customerId: number, items: NewOrderItem[]): Promise<OrderDetail> {
  const quantities = new Map<number, number>();
  for (const item of items)
    quantities.set(item.product_id, (quantities.get(item.product_id) ?? 0) + item.quantity);
  const ids = [...quantities.keys()].sort((a, b) => a - b);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='10s'; SET LOCAL statement_timeout='15s'");
    const customer = (
      await client.query<{ email: string }>(
        'SELECT email FROM sales.customers WHERE id = $1 FOR KEY SHARE',
        [customerId],
      )
    ).rows[0];
    if (!customer) throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Cliente no encontrado');
    // Orden global de bloqueo incluso si cambia el orden de los productos del payload.
    const products = await client.query<{ id: number; stock: number }>(
      'SELECT id, stock FROM sales.products WHERE id = ANY($1::integer[]) ORDER BY id FOR UPDATE',
      [ids],
    );
    if (products.rows.length !== ids.length) {
      const found = new Set(products.rows.map((product) => product.id));
      throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Producto no encontrado', {
        product_ids: ids.filter((id) => !found.has(id)),
      });
    }
    const unavailable = products.rows.filter(
      (product) => product.stock < quantities.get(product.id)!,
    );
    if (unavailable.length)
      throw new HttpError(409, 'INSUFFICIENT_STOCK', 'Stock insuficiente', {
        products: unavailable.map((product) => ({
          product_id: product.id,
          available: product.stock,
          requested: quantities.get(product.id),
        })),
      });
    const updated = await client.query(
      `UPDATE sales.products p SET stock = p.stock - requested.quantity
      FROM unnest($1::integer[], $2::integer[]) AS requested(id, quantity)
      WHERE p.id = requested.id AND p.stock >= requested.quantity RETURNING p.id`,
      [ids, ids.map((id) => quantities.get(id))],
    );
    if (updated.rowCount !== ids.length)
      throw new HttpError(409, 'INSUFFICIENT_STOCK', 'Stock insuficiente');
    const inserted = await client.query<{ id: number; order_ref: string }>(
      `INSERT INTO sales.orders
      (order_ref, customer_email, customer_key, status, created_at)
      VALUES ($1, $2, $2, 'pending', clock_timestamp()) RETURNING id, order_ref`,
      [`WEB-${randomUUID()}`, customer.email],
    );
    const order = inserted.rows[0]!;
    await client.query(
      `INSERT INTO sales.order_items (order_ref, order_key, sku, quantity, unit_price)
      SELECT $1, $1, p.sku, requested.quantity, p.price
      FROM jsonb_to_recordset($2::jsonb) AS requested(product_id integer, quantity integer)
      JOIN sales.products p ON p.id = requested.product_id`,
      [order.order_ref, JSON.stringify(items)],
    );
    const detail = await findOrder(order.id, client);
    if (!detail) throw new Error('El pedido insertado no pudo recuperarse');
    await client.query('COMMIT');
    return detail;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export const UPDATE_ORDER_STATUS_SQL = `UPDATE sales.orders SET status = $1
  WHERE id = $2 AND status = $3 RETURNING id, order_ref, status`;
export async function updateOrderStatus(
  id: number,
  status: OrderStatus,
  expectedStatus: OrderStatus,
) {
  return (await pool.query(UPDATE_ORDER_STATUS_SQL, [status, id, expectedStatus])).rows[0] ?? null;
}
export async function findCustomers(limit: number, after?: string, search?: string) {
  const values: unknown[] = [limit + 1];
  const conditions: string[] = [];
  if (after) {
    values.push(after);
    conditions.push(`email > $${values.length}`);
  }
  if (search) {
    values.push(`%${search.replace(/[\\%_]/g, '\\$&')}%`);
    conditions.push(`(full_name ILIKE $${values.length} OR email ILIKE $${values.length})`);
  }
  return (
    await pool.query(
      `SELECT id, email, full_name, city FROM sales.customers
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY email LIMIT $1`,
      values,
    )
  ).rows;
}
export async function findCatalogProducts(limit: number, after?: string, search?: string) {
  const values: unknown[] = [limit + 1];
  const conditions: string[] = [];
  if (after) {
    values.push(after);
    conditions.push(`sku > $${values.length}`);
  }
  if (search) {
    values.push(`%${search.replace(/[\\%_]/g, '\\$&')}%`);
    conditions.push(`(name ILIKE $${values.length} OR sku ILIKE $${values.length})`);
  }
  return (
    await pool.query(
      `SELECT id, sku, name, round(price, 2)::text AS price, stock FROM sales.products
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY sku LIMIT $1`,
      values,
    )
  ).rows;
}
