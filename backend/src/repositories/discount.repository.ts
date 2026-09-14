import { pool } from '../db';

export interface DiscountItem {
  id: number;
  product_id: number;
  sku: string;
  quantity: number;
  unit_price: string;
}
export interface DiscountOrder {
  id: number;
  items: DiscountItem[];
}
// Consulta única: un mismo snapshot de precios históricos y líneas, sin escrituras.
export const DISCOUNT_ORDER_SQL = `SELECT o.id, COALESCE(lines.items, '[]'::jsonb) AS items
  FROM sales.orders o
  CROSS JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('id', i.id, 'product_id', p.id, 'sku', i.sku,
      'quantity', i.quantity, 'unit_price', round(i.unit_price, 2)::text) ORDER BY i.id) AS items
    FROM sales.order_items i JOIN sales.products p ON p.sku = i.sku
    WHERE i.order_ref = o.order_ref
  ) lines WHERE o.id = $1`;
export async function findDiscountOrder(id: number): Promise<DiscountOrder | null> {
  return (await pool.query<DiscountOrder>(DISCOUNT_ORDER_SQL, [id])).rows[0] ?? null;
}
