import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { pool } from './db';

interface CsvRow {
  codigo: string;
  nombre: string;
  categoria: string;
  precio: string;
  stock: string;
  proveedor: string;
  fecha_actualizacion: string;
}

interface Product {
  codigo: string;
  nombre: string;
  categoria: string;
  precio: number;
  stock: number;
  proveedor: string | null;
  fecha_actualizacion: string;
}

interface ValidationResult {
  valid: boolean;
  product?: Product;
  errors: string[];
}

function isValidISODate(value: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;

  if (!regex.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);

  if (year === undefined || month === undefined || day === undefined) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validateRow(row: CsvRow): ValidationResult {
  const errors: string[] = [];

  const codigo = row.codigo?.trim();
  const nombre = row.nombre?.trim();
  const categoria = row.categoria?.trim();
  const proveedor = row.proveedor?.trim() || null;
  const fecha = row.fecha_actualizacion?.trim();

  const precio = Number(row.precio);
  const stock = Number(row.stock);

  if (!codigo) {
    errors.push('codigo es obligatorio');
  }

  if (!nombre) {
    errors.push('nombre es obligatorio');
  }

  if (!categoria) {
    errors.push('categoria es obligatoria');
  }

  if (!Number.isInteger(precio) || precio < 0) {
    errors.push('precio debe ser un entero mayor o igual a 0');
  }

  if (!Number.isInteger(stock) || stock < 0) {
    errors.push('stock debe ser un entero mayor o igual a 0');
  }

  if (!fecha || !isValidISODate(fecha)) {
    errors.push('fecha_actualizacion debe usar formato YYYY-MM-DD');
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return {
    valid: true,
    errors: [],
    product: {
      codigo,
      nombre,
      categoria,
      precio,
      stock,
      proveedor,
      fecha_actualizacion: fecha,
    },
  };
}

async function main() {
  const csvPath = path.resolve(
    process.cwd(),
    '../data/ecofor_simulacion_inventario.csv'
  );

  console.log(`Leyendo CSV: ${csvPath}`);

  const fileContent = fs.readFileSync(csvPath, 'utf-8');

  const rows = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  }) as CsvRow[];

  console.log(`Filas leídas: ${rows.length}`);

  const validProducts: Product[] = [];
  let rejected = 0;

  rows.forEach((row, index) => {
    const result = validateRow(row);

    if (!result.valid || !result.product) {
      rejected++;

      console.error(
        `Fila ${index + 2} rechazada [${row.codigo || 'SIN CODIGO'}]:`,
        result.errors.join(', ')
      );

      return;
    }

    validProducts.push(result.product);
  });

  console.log(`Filas válidas: ${validProducts.length}`);
  console.log(`Filas rechazadas: ${rejected}`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const product of validProducts) {
      await client.query(
        `
        INSERT INTO products (
          codigo,
          nombre,
          categoria,
          precio,
          stock,
          proveedor,
          fecha_actualizacion
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)

        ON CONFLICT (codigo)
        DO UPDATE SET
          nombre = EXCLUDED.nombre,
          categoria = EXCLUDED.categoria,
          precio = EXCLUDED.precio,
          stock = EXCLUDED.stock,
          proveedor = EXCLUDED.proveedor,
          fecha_actualizacion = EXCLUDED.fecha_actualizacion,
          updated_at = NOW()
        `,
        [
          product.codigo,
          product.nombre,
          product.categoria,
          product.precio,
          product.stock,
          product.proveedor,
          product.fecha_actualizacion,
        ]
      );
    }

    await client.query('COMMIT');

    console.log(
      `Ingesta completada correctamente. ${validProducts.length} registros procesados mediante UPSERT.`
    );
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Error durante la ingesta:', error);

    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
