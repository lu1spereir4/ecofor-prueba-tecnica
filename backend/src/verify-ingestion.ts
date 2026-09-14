import assert from 'node:assert/strict';
import path from 'node:path';
import { pool } from './db';
import { ingestSales } from './ingest-sales';

async function fingerprints() {
  const result: Record<string, unknown> = {};
  for (const table of [
    'sales.customers',
    'sales.products',
    'sales.orders',
    'sales.order_items',
    'sales.customer_source_rows',
    'sales.product_source_rows',
    'public.products',
  ]) {
    result[table] = (
      await pool.query(`SELECT count(*)::text AS rows,
      sum(hashtextextended(to_jsonb(t)::text, 0)::numeric)::text AS fingerprint FROM ${table} t`)
    ).rows[0];
  }
  return result;
}
async function main() {
  const before = await fingerprints();
  const started = performance.now();
  await ingestSales(path.resolve(process.argv[2] ?? path.resolve(__dirname, '../../data')));
  const after = await fingerprints();
  assert.deepEqual(
    after,
    before,
    'La base debe tener cargados los mismos CSV antes de esta verificación',
  );
  console.log('Reingesta verificada: recuentos y huellas de todas las filas coinciden.', after);
  console.log(
    `Tiempo de reingesta y comprobación: ${((performance.now() - started) / 1000).toFixed(1)} s`,
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
