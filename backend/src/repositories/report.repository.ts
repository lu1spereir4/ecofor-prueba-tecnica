import { pool } from '../db';

export const TOP_CUSTOMERS_SQL = `WITH recent_orders AS MATERIALIZED (
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
ORDER BY r.amount DESC, c.id ASC LIMIT 10`;

export async function topCustomers(asOf: string) {
  return (await pool.query(TOP_CUSTOMERS_SQL, [asOf])).rows;
}
