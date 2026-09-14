import express, {
  Request,
  Response,
  NextFunction
} from 'express';

import cors from 'cors';

import productRoutes from './routes/product.routes';

const app = express();

app.use(cors());

app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok'
  });
});

app.use('/api/products', productRoutes);

app.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    console.error(error);

    res.status(500).json({
      message: 'Error interno del servidor'
    });
  }
);

export default app;