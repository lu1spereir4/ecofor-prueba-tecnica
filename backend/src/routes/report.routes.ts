import { Router } from 'express';
import { getTopCustomers } from '../controllers/report.controller';
import { topCustomersValidation } from '../middleware/report.validation';
const router = Router();
router.get('/top-customers', topCustomersValidation, getTopCustomers);
export default router;
