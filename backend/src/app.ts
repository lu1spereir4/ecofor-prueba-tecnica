import express from 'express';
import cors from 'cors';
import productRoutes from './routes/product.routes';
import orderRoutes from './routes/order.routes';
import reportRoutes from './routes/report.routes';
import catalogRoutes from './routes/catalog.routes';
import { errorHandler, notFound } from './middleware/errors';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.get('/', (_req, res) => {
  res.json({
    name: 'ECOFOR API',
    endpoints: {
      health: '/health',
      orders: '/orders',
      customers: '/api/customers',
      products: '/api/catalog/products',
      top_customers: '/reports/top-customers',
    },
  });
});
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});
app.use('/api/products', productRoutes);
app.use(['/orders', '/api/orders'], orderRoutes);
app.use(['/reports', '/api/reports'], reportRoutes);
app.use('/api', catalogRoutes);
app.use(notFound);
app.use(errorHandler);
export default app;
