import { Router } from 'express';
import { body, param, query } from 'express-validator';

import { getProducts, patchProductStock } from '../controllers/product.controller';

import { validateRequest } from '../middleware/validate';

const router = Router();

router.get(
  '/',
  query('search').optional().isString().trim(),

  query('category').optional().isString().trim(),

  validateRequest,
  getProducts,
);

router.patch(
  '/:id/stock',

  param('id').isInt({ min: 1 }).withMessage('id debe ser un entero positivo'),

  body('stock')
    .custom((value) => typeof value === 'number' && Number.isInteger(value))
    .isInt({ min: 0, max: 2147483647 })
    .withMessage('stock debe ser un entero mayor o igual a 0'),

  validateRequest,
  patchProductStock,
);

export default router;
