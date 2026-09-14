import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { from as copyFrom } from 'pg-copy-streams';
import type { Pool } from 'pg';
import { pool } from './db';
import { MAINTENANCE_LOCK } from './migrate';

const datasets = [
  { table: 'customers', columns: ['email', 'full_name', 'city'], key: 'email' },
  { table: 'products', columns: ['sku', 'name', 'price', 'stock'], key: 'sku' },
  {
    table: 'orders',
    columns: ['order_ref', 'customer_email', 'status', 'created_at'],
    key: 'order_ref',
  },
  {
    table: 'order_items',
    columns: ['order_ref', 'sku', 'quantity', 'unit_price'],
    key: 'source_row',
  },
] as const;

// Los cuatro CSV constituyen una instantánea autoritativa de sales.
// public.products y channel (no provisto en CSV) no se modifican.
export async function ingestSales(directory: string, database: Pool = pool) {
  for (const dataset of datasets) await access(path.join(directory, `${dataset.table}.csv`));
  const client = await database.connect();
  let locked = false;
  const counts: Record<string, number> = {};
  try {
    locked = (await client.query('SELECT pg_try_advisory_lock($1) AS locked', [MAINTENANCE_LOCK]))
      .rows[0].locked;
    if (!locked) throw new Error('Hay otra migración o ingesta en ejecución');
    await client.query('BEGIN');
    await client.query("SET LOCAL TIME ZONE 'UTC'; SET LOCAL lock_timeout = '5s'");
    for (const { table, columns, key } of datasets) {
      // LIKE copia tipos, NOT NULL y CHECK; no copia FK ni índices.
      await client.query(
        `CREATE TEMP TABLE stage_${table} (LIKE sales.${table} INCLUDING CONSTRAINTS INCLUDING DEFAULTS) ON COMMIT DROP`,
      );
      // Las identidades HTTP no provienen del CSV; LIKE no copia su generación.
      await client.query(`ALTER TABLE stage_${table} DROP COLUMN IF EXISTS id`);
      if (table === 'customers' || table === 'products') {
        await client.query(
          `ALTER TABLE stage_${table} ADD COLUMN source_row BIGINT GENERATED ALWAYS AS IDENTITY`,
        );
      } else if (table === 'order_items') {
        await client.query('ALTER TABLE stage_order_items ALTER COLUMN source_row SET NOT NULL');
        await client.query(
          'ALTER TABLE stage_order_items ALTER COLUMN source_row ADD GENERATED ALWAYS AS IDENTITY',
        );
      }
      console.log(`COPY ${table}.csv...`);
      try {
        await pipeline(
          createReadStream(path.join(directory, `${table}.csv`)),
          client.query(
            copyFrom(
              `COPY stage_${table} (${columns.join(',')}) FROM STDIN WITH (FORMAT csv, HEADER MATCH, ENCODING 'UTF8')`,
            ),
          ),
        );
      } catch (error) {
        throw new Error(`No se pudo cargar ${table}.csv`, { cause: error });
      }
      await client.query(
        `ALTER TABLE stage_${table} ADD PRIMARY KEY (${table === 'customers' || table === 'products' ? 'source_row' : key})`,
      );
      if (table === 'customers' || table === 'products') {
        // Regla determinista: última aparición, con archivo completo conservado.
        await client.query(`CREATE TEMP TABLE current_${table} ON COMMIT DROP AS
          SELECT DISTINCT ON (${key}) ${columns.join(',')} FROM stage_${table} ORDER BY ${key}, source_row DESC`);
        await client.query(`ALTER TABLE current_${table} ADD PRIMARY KEY (${key})`);
        await client.query(`ANALYZE current_${table}`);
      }
      await client.query(`ANALYZE stage_${table}`);
      counts[table] = Number(
        (await client.query(`SELECT count(*) FROM stage_${table}`)).rows[0].count,
      );
      if (!counts[table]) throw new Error(`${table}.csv está vacío; se cancela la instantánea`);
      console.log(`${table}: ${counts[table]} registros validados`);
    }

    // No se inventan entidades para referencias ausentes; quedan sin resolver.
    const references = await client.query(`
      SELECT i.sku FROM stage_order_items i
      WHERE NOT EXISTS (SELECT 1 FROM current_products p WHERE p.sku = i.sku)
      LIMIT 1`);
    if (references.rowCount)
      throw new Error('Hay SKU de ítems ausentes en products.csv; se cancela la instantánea');

    // Lecturas MVCC continúan; las escrituras esperan durante la sincronización.
    await client.query(
      'LOCK TABLE sales.customers, sales.products, sales.orders, sales.order_items, sales.customer_source_rows, sales.product_source_rows IN SHARE ROW EXCLUSIVE MODE',
    );
    for (const { table, columns, key } of datasets) {
      const baseColumns: readonly string[] =
        table === 'order_items' ? ['source_row', ...columns] : columns;
      const linkedColumn =
        table === 'orders' ? 'customer_key' : table === 'order_items' ? 'order_key' : null;
      const allColumns = linkedColumn ? [...baseColumns, linkedColumn] : baseColumns;
      const source =
        table === 'customers' || table === 'products' ? `current_${table}` : `stage_${table}`;
      const join =
        table === 'orders'
          ? 'LEFT JOIN current_customers linked ON linked.email = source.customer_email'
          : table === 'order_items'
            ? 'LEFT JOIN stage_orders linked ON linked.order_ref = source.order_ref'
            : '';
      const resolved =
        table === 'orders' ? ', linked.email' : table === 'order_items' ? ', linked.order_ref' : '';
      const changed = allColumns.filter((column) => column !== key);
      console.log(`Sincronizando ${table}...`);
      await client.query(`INSERT INTO sales.${table} AS current (${allColumns.join(',')})
        SELECT ${baseColumns.map((column) => `source.${column}`).join(',')}${resolved} FROM ${source} source ${join}
        ON CONFLICT (${key}) DO UPDATE SET ${changed.map((column) => `${column} = EXCLUDED.${column}`).join(',')}
        WHERE (${changed.map((column) => `current.${column}`).join(',')})
          IS DISTINCT FROM (${changed.map((column) => `EXCLUDED.${column}`).join(',')})`);
    }
    for (const [table, source, columns] of [
      ['customer_source_rows', 'customers', ['email', 'full_name', 'city']],
      ['product_source_rows', 'products', ['sku', 'name', 'price', 'stock']],
    ] as const) {
      await client.query(`INSERT INTO sales.${table} AS current (source_row, ${columns.join(',')})
        SELECT source_row, ${columns.join(',')} FROM stage_${source}
        ON CONFLICT (source_row) DO UPDATE SET ${columns.map((column) => `${column} = EXCLUDED.${column}`).join(',')}
        WHERE (${columns.map((column) => `current.${column}`).join(',')}) IS DISTINCT FROM (${columns.map((column) => `EXCLUDED.${column}`).join(',')})`);
      await client.query(`DELETE FROM sales.${table} target WHERE NOT EXISTS
        (SELECT 1 FROM stage_${source} source WHERE source.source_row = target.source_row)`);
    }
    for (const { table, key } of [...datasets].reverse()) {
      await client.query(`DELETE FROM sales.${table} target
        WHERE NOT EXISTS (SELECT 1 FROM ${table === 'customers' || table === 'products' ? 'current' : 'stage'}_${table} source WHERE source.${key} = target.${key})`);
    }
    await client.query('COMMIT');
    // ANALYZE fuera de la transacción evita alargar el bloqueo de escritores.
    for (const { table } of datasets) await client.query(`ANALYZE sales.${table}`);
    await client.query('ANALYZE sales.customer_source_rows; ANALYZE sales.product_source_rows');
    console.log('Ingesta confirmada:', counts);
    return counts;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock($1)', [MAINTENANCE_LOCK]);
    client.release();
  }
}

if (require.main === module) {
  const directory = path.resolve(process.argv[2] ?? path.resolve(__dirname, '../../data'));
  ingestSales(directory)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
