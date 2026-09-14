import { Router } from 'express';
import { getCustomers, getCatalogProducts } from '../controllers/order.controller';
import { catalogValidation } from '../middleware/order.validation';
const router = Router();
router.get('/customers', catalogValidation, getCustomers);
router.get('/catalog/products', catalogValidation, getCatalogProducts);
export default router;
