import type { Request, Response } from 'express';
import {
  createOrder,
  findOrders,
  findOrder,
  updateOrderStatus,
  findCustomers,
  findCatalogProducts,
} from '../repositories/order.repository';
import type { OrderFilters } from '../repositories/order.repository';
import { decodeCursor } from '../utils/order-cursor';
import { normalizeDate } from '../utils/dates';
import { HttpError } from '../middleware/errors';
export { decodeCursor } from '../utils/order-cursor';

export async function postOrder(req: Request, res: Response) {
  const data = await createOrder(req.body.customer_id, req.body.items);
  res.location(`${req.baseUrl}/${data.id}`).status(201).json({ data });
}
export async function getOrders(req: Request, res: Response) {
  const filters: OrderFilters = { limit: Number(req.query.limit ?? 20) };
  for (const [query, field] of [
    ['status', 'status'],
    ['customer', 'customer'],
    ['customer_email', 'customerEmail'],
    ['order_ref', 'orderRef'],
  ] as const) {
    if (typeof req.query[query] === 'string') filters[field] = req.query[query];
  }
  if (typeof req.query.from === 'string') filters.from = normalizeDate(req.query.from);
  if (typeof req.query.to === 'string') filters.to = normalizeDate(req.query.to);
  if (typeof req.query.cursor === 'string') filters.cursor = decodeCursor(req.query.cursor);
  res.json(await findOrders(filters));
}
export async function getOrder(req: Request, res: Response) {
  const data = await findOrder(Number(req.params.id));
  if (!data) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Pedido no encontrado');
  res.json({ data });
}
export async function patchOrderStatus(req: Request, res: Response) {
  const data = await updateOrderStatus(
    Number(req.params.id),
    req.body.status,
    req.body.expected_status,
  );
  if (!data)
    throw new HttpError(
      409,
      'ORDER_STATE_CONFLICT',
      'El pedido no existe o su estado cambió. Recarga el detalle antes de guardar.',
    );
  res.json({ data });
}
export async function getCustomers(req: Request, res: Response) {
  const limit = Number(req.query.limit ?? 20);
  const rows = await findCustomers(
    limit,
    typeof req.query.after === 'string' ? req.query.after : undefined,
    typeof req.query.search === 'string' ? req.query.search.trim() : undefined,
  );
  const data = rows.slice(0, limit);
  res.json({ data, nextCursor: rows.length > limit ? data.at(-1).email : null });
}
export async function getCatalogProducts(req: Request, res: Response) {
  const limit = Number(req.query.limit ?? 20);
  const rows = await findCatalogProducts(
    limit,
    typeof req.query.after === 'string' ? req.query.after : undefined,
    typeof req.query.search === 'string' ? req.query.search.trim() : undefined,
  );
  const data = rows.slice(0, limit);
  res.json({ data, nextCursor: rows.length > limit ? data.at(-1).sku : null });
}
