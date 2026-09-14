import { Request, Response, NextFunction } from 'express';

import { findProducts, updateProductStock } from '../repositories/product.repository';

export async function getProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;

    const category = typeof req.query.category === 'string' ? req.query.category.trim() : undefined;

    const products = await findProducts({
      ...(search !== undefined ? { search } : {}),
      ...(category !== undefined ? { category } : {}),
    });

    res.status(200).json({
      data: products,
      count: products.length,
    });
  } catch (error) {
    next(error);
  }
}

export async function patchProductStock(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const stock = Number(req.body.stock);

    const product = await updateProductStock(id, stock);

    if (!product) {
      res.status(404).json({
        message: 'Producto no encontrado',
      });

      return;
    }

    res.status(200).json({
      data: product,
    });
  } catch (error) {
    next(error);
  }
}
