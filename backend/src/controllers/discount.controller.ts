import type { Request, Response } from 'express';
import { findDiscountOrder } from '../repositories/discount.repository';
import { calculateDiscounts } from '../services/discount.service';
import { HttpError } from '../middleware/errors';

export async function applyDiscounts(req: Request, res: Response) {
  const order = await findDiscountOrder(Number(req.params.id));
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Pedido no encontrado');
  if (order.items.length > 100)
    throw new HttpError(
      422,
      'ORDER_ITEM_LIMIT',
      'La evaluación admite pedidos con hasta 100 ítems; no se truncaron las líneas',
    );
  res.json(calculateDiscounts(order, req.body.coupons));
}
