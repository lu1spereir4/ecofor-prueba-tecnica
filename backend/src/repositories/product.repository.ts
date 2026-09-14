import { pool } from '../db';

export async function updateCatalogStock(id: number, stock: number) {
  const result = await pool.query(
    `UPDATE sales.products SET stock = $1 WHERE id = $2
     RETURNING id, sku, name, round(price, 2)::text AS price, stock`,
    [stock, id],
  );
  return result.rows[0] ?? null;
}

interface ProductFilters {
  search?: string;
  category?: string;
}

export async function findProducts(filters: ProductFilters) {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.search) {
    values.push(`%${filters.search}%`);

    conditions.push(`(nombre ILIKE $${values.length} OR codigo ILIKE $${values.length})`);
  }

  if (filters.category) {
    values.push(filters.category);

    conditions.push(`categoria = $${values.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `
      SELECT
        id,
        codigo,
        nombre,
        categoria,
        precio,
        stock,
        proveedor,
        fecha_actualizacion
      FROM products
      ${where}
      ORDER BY codigo
    `,
    values,
  );

  return result.rows;
}

export async function updateProductStock(id: number, stock: number) {
  const result = await pool.query(
    `
      UPDATE products
      SET
        stock = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        codigo,
        nombre,
        categoria,
        precio,
        stock,
        proveedor,
        fecha_actualizacion
    `,
    [stock, id],
  );

  return result.rows[0] ?? null;
}
