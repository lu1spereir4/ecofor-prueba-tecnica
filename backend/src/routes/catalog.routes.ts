import { Router } from 'express';
import { body, param } from 'express-validator';
import { validateRequest } from '../middleware/validate';
import { patchCatalogStock } from '../controllers/product.controller';
import { getCustomers, getCatalogProducts } from '../controllers/order.controller';
import { catalogValidation } from '../middleware/order.validation';
const router = Router();
router.get('/customers', catalogValidation, getCustomers);
router.get('/catalog/products', catalogValidation, getCatalogProducts);
router.patch(
  '/catalog/products/:id/stock',
  param('id').isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }),
  body('stock')
    .custom((value) => typeof value === 'number' && Number.isInteger(value))
    .isInt({ min: 0, max: 2147483647 })
    .withMessage('stock debe ser un entero entre 0 y 2147483647'),
  validateRequest,
  patchCatalogStock,
);
export default router;
