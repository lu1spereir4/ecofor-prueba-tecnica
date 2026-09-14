import { Router } from 'express';
import { getOrders, getOrder, postOrder, patchOrderStatus } from '../controllers/order.controller';
import { applyDiscounts } from '../controllers/discount.controller';
import {
  createOrderValidation,
  listOrdersValidation,
  detailOrderValidation,
  statusOrderValidation,
} from '../middleware/order.validation';
import { discountValidation } from '../middleware/discount.validation';
import { requireJson } from '../middleware/errors';

const router = Router();
router.post('/', requireJson, createOrderValidation, postOrder);
router.get('/', listOrdersValidation, getOrders);
router.get('/:id', detailOrderValidation, getOrder);
router.post('/:id/apply-discounts', requireJson, discountValidation, applyDiscounts);
router.patch('/:id/status', requireJson, statusOrderValidation, patchOrderStatus);
export default router;
