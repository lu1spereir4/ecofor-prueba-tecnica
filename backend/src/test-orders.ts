import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { pool } from './db';
import { migrate } from './migrate';
import { ingestSales } from './ingest-sales';
import app from './app';
import { readJson } from './test-support/http';
import type { Page } from './test-support/http';
import type { OrderDetail } from './repositories/order.repository';

const tables = [
  'customers',
  'products',
  'orders',
  'order_items',
  'customer_source_rows',
  'product_source_rows',
];
async function snapshot() {
  const result: Record<string, unknown> = {};
  for (const table of tables)
    result[table] = (
      await pool.query(`SELECT to_jsonb(t) AS row FROM sales.${table} t ORDER BY to_jsonb(t)::text`)
    ).rows;
  return result;
}
function csv(rows: unknown[][]) {
  return (
    rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\r\n') + '\r\n'
  );
}

async function worker() {
  assert.match(process.env.DB_NAME ?? '', /^ecofor_test_\d+$/);
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ecofor-orders-'));
  let server: ReturnType<typeof app.listen> | undefined;
  try {
    await migrate(pool, '002_sales.sql');
    await pool.query(`INSERT INTO sales.customers VALUES ('seed@example.cl','Seed','Santiago');
      INSERT INTO sales.orders VALUES ('SEED','seed@example.cl','pending','2026-01-01T00:00:00.123456Z')`);
    const before = (
      await pool.query("SELECT relfilenode FROM pg_class WHERE oid='sales.orders'::regclass")
    ).rows[0];
    const blocker = await pool.connect();
    try {
      await blocker.query('BEGIN; SELECT * FROM sales.orders');
      let completed = false;
      const migration = migrate(pool, '003_orders_channel.sql').then(() => {
        completed = true;
      });
      await delay(400);
      assert.equal(completed, false, 'La migración debe reintentar mientras existe un lector');
      const concurrent = await pool.connect();
      try {
        await concurrent.query("SET statement_timeout='500ms'");
        await concurrent.query('SELECT * FROM sales.orders');
        await concurrent.query("UPDATE sales.orders SET status='paid' WHERE order_ref='SEED'");
        await concurrent.query('RESET statement_timeout');
      } finally {
        concurrent.release();
      }
      await blocker.query('COMMIT');
      await migration;
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
    }
    assert.deepEqual(
      (await pool.query("SELECT relfilenode FROM pg_class WHERE oid='sales.orders'::regclass"))
        .rows[0],
      before,
      'No debe reescribir el heap',
    );
    assert.equal(
      (await pool.query("SELECT channel FROM sales.orders WHERE order_ref='SEED'")).rows[0].channel,
      'web',
    );
    assert.equal(
      (
        await pool.query(
          "SELECT attnotnull AND atthasmissing AS fast FROM pg_attribute WHERE attrelid='sales.orders'::regclass AND attname='channel'",
        )
      ).rows[0].fast,
      true,
    );
    await assert.rejects(pool.query("UPDATE sales.orders SET channel=NULL WHERE order_ref='SEED'"));
    await migrate();
    await migrate();
    assert.equal(
      (await pool.query('SELECT count(*)::int AS count FROM public.schema_migrations')).rows[0]
        .count,
      5,
    );

    const files = {
      customers: [
        ['email', 'full_name', 'city'],
        ['a@example.cl', 'Primera', 'Temuco'],
        ['b@example.cl', 'Benjamín', 'Talca'],
        ['a@example.cl', 'Última, María\nPérez', 'Chillán'],
      ],
      products: [
        ['sku', 'name', 'price', 'stock'],
        ['P1', 'Original', '0.50', 1],
        ['P2', 'Grande', '9999999999999999.99', 3],
        ['P1', 'Último', '0.10', 7],
      ],
      orders: [
        ['order_ref', 'customer_email', 'status', 'created_at'],
        ['R1', 'a@example.cl', 'pending', '2026-01-01T00:00:00.123456Z'],
        ['R2', 'missing@example.cl', 'paid', '2026-01-01T00:00:00.123456Z'],
        ['R3', 'b@example.cl', 'shipped', '2026-01-01T00:00:00.123455Z'],
        ['R4', 'a@example.cl', 'cancelled', '2025-12-31T23:59:59Z'],
      ],
      order_items: [
        ['order_ref', 'sku', 'quantity', 'unit_price'],
        ['R1', 'P1', 3, '0.10'],
        ['R1', 'P1', 3, '0.10'],
        ['R1', 'P1', 2, '0.20'],
        ['R2', 'P2', 3, '9999999999999999.99'],
        ['R3', 'P1', 1, '0.10'],
        ['MISSING', 'P1', 1, '0.20'],
      ],
    };
    for (const [name, rows] of Object.entries(files))
      await writeFile(path.join(directory, `${name}.csv`), csv(rows));
    await ingestSales(directory);
    const first = await snapshot();
    await ingestSales(directory);
    assert.deepEqual(
      await snapshot(),
      first,
      'La reingesta debe producir exactamente las mismas filas',
    );
    assert.equal(
      (await pool.query("SELECT full_name FROM sales.customers WHERE email='a@example.cl'")).rows[0]
        .full_name,
      'Última, María\nPérez',
    );
    assert.equal(
      (await pool.query('SELECT count(*)::int AS count FROM sales.customer_source_rows')).rows[0]
        .count,
      3,
    );
    assert.equal(
      (
        await pool.query(
          'SELECT count(*)::int AS count FROM sales.order_items WHERE order_key IS NULL',
        )
      ).rows[0].count,
      1,
    );
    assert.equal(
      (await pool.query("SELECT customer_key FROM sales.orders WHERE order_ref='R2'")).rows[0]
        .customer_key,
      null,
    );
    await pool.query("UPDATE sales.orders SET channel='phone' WHERE order_ref='R1'");
    await ingestSales(directory);
    assert.equal(
      (await pool.query("SELECT channel FROM sales.orders WHERE order_ref='R1'")).rows[0].channel,
      'phone',
    );
    await pool.query("UPDATE sales.orders SET channel='web' WHERE order_ref='R1'");

    // Forzar un fallo después de que los primeros padres ya fueron modificados.
    await pool.query(`CREATE FUNCTION sales.test_reject_order() RETURNS trigger LANGUAGE plpgsql AS
      $$ BEGIN RAISE EXCEPTION 'Fallo de prueba durante sincronización'; END $$;
      CREATE TRIGGER test_reject_order BEFORE INSERT ON sales.orders FOR EACH ROW EXECUTE FUNCTION sales.test_reject_order()`);
    await writeFile(
      path.join(directory, 'products.csv'),
      csv([...files.products, ['P1', 'Cambio a revertir', '1.00', 99]]),
    );
    try {
      await assert.rejects(ingestSales(directory));
      assert.deepEqual(
        await snapshot(),
        first,
        'También se revierten escrituras de tablas ya sincronizadas',
      );
    } finally {
      await pool.query(
        'DROP TRIGGER test_reject_order ON sales.orders; DROP FUNCTION sales.test_reject_order()',
      );
      await writeFile(path.join(directory, 'products.csv'), csv(files.products));
    }

    // Errores en diferentes etapas: ninguna publicación parcial.
    for (const [file, content] of [
      [
        'products',
        csv([
          ['wrong', 'name', 'price', 'stock'],
          ['P1', 'Bad', '0.10', 1],
        ]),
      ],
      ['products', csv([files.products[0]!, ['P1', 'Bad', '0.001', 1]])],
      ['order_items', csv([files.order_items[0]!, ['R1', 'UNKNOWN', 1, '0.10']])],
      ['order_items', csv([files.order_items[0]!, ['R1', 'P1', 0, '0.10']])],
      ['orders', csv([...files.orders, files.orders[1]!])],
    ]) {
      await writeFile(path.join(directory, `${file}.csv`), content!);
      await assert.rejects(ingestSales(directory));
      assert.deepEqual(await snapshot(), first, 'Un fallo de carga debe revertir todo');
      await writeFile(path.join(directory, `${file}.csv`), csv(files[file as keyof typeof files]));
    }

    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}/api`;
    const orderIds = Object.fromEntries(
      (await pool.query('SELECT order_ref, id FROM sales.orders')).rows.map((row) => [
        row.order_ref,
        row.id,
      ]),
    );
    const get = async <T = Page<OrderDetail>>(route: string) => {
      route = route.replace(
        /^\/orders\/(R[1-4])$/,
        (_match, ref: string) => `/orders/${orderIds[ref]}`,
      );
      const result = await fetch(base + route);
      assert.equal(result.status, 200, route);
      return readJson<T>(result);
    };
    const references: string[] = [];
    let cursor: string | null = null;
    do {
      const page: Page<OrderDetail> = await get(
        `/orders?limit=1${cursor ? `&cursor=${cursor}` : ''}`,
      );
      references.push(...page.data.map((order: { order_ref: string }) => order.order_ref));
      cursor = page.nextCursor;
    } while (cursor);
    assert.deepEqual(
      references,
      ['R2', 'R1', 'R3', 'R4'],
      'Cursor sin saltos ni duplicados, con empates y microsegundos',
    );
    assert.equal((await get<{ data: OrderDetail }>('/orders/R1')).data.total, '1.00');
    assert.equal((await get<{ data: OrderDetail }>('/orders/R1')).data.items.length, 3);
    assert.equal(
      (await get<{ data: OrderDetail }>('/orders/R2')).data.total,
      '29999999999999999.97',
    );
    assert.equal((await get<{ data: OrderDetail }>('/orders/R4')).data.total, '0.00');
    assert.equal((await get('/orders?status=paid')).data.length, 1);
    assert.equal((await get('/orders?customer_email=a%40example.cl')).data.length, 2);
    assert.equal(
      (await get('/orders?from=2026-01-01T00:00:00Z&to=2026-01-02T00:00:00Z')).data.length,
      3,
    );
    assert.equal(
      (await get('/orders?from=2026-01-01T00:00:00.123455Z&to=2026-01-01T00:00:00.123456Z')).data
        .length,
      3,
    );
    assert.equal((await get('/orders?order_ref=R1')).data.length, 1);
    assert.equal((await get('/orders?order_ref=%27%20OR%201%3D1--')).data.length, 0);
    assert.equal((await get('/customers?limit=1')).nextCursor, 'a@example.cl');
    assert.equal((await get('/customers?after=a%40example.cl')).data.length, 1);
    assert.equal(
      (await get<Page<{ price: string }>>('/catalog/products?after=P1')).data[0]?.price,
      '9999999999999999.99',
    );
    assert.equal((await fetch(`${base}/orders/2147483647`)).status, 404);
    const invalidCursor = Buffer.from(
      JSON.stringify({ created_at: '2026-02-30T00:00:00.123456Z', order_ref: 'R1' }),
    ).toString('base64url');
    for (const query of [
      'limit=0',
      'limit=101',
      'limit=1&limit=2',
      'status=invalid',
      'cursor=abc',
      `cursor=${invalidCursor}`,
      'from=2026-02-30T00:00:00Z',
      'from=2026-01-02T00:00:00Z&to=2026-01-01T00:00:00Z',
    ]) {
      assert.equal((await fetch(`${base}/orders?${query}`)).status, 400, query);
    }
    const patch = (status: string, expected_status: string) =>
      fetch(`${base}/orders/${orderIds.R1}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, expected_status }),
      });
    const updates = await Promise.all([patch('paid', 'pending'), patch('shipped', 'pending')]);
    assert.deepEqual(updates.map((result) => result.status).sort(), [200, 409]);
    assert.equal((await patch('wrong', 'paid')).status, 400);
    // Un snapshot más pequeño elimina filas antiguas; vínculos se vuelven pendientes.
    await writeFile(path.join(directory, 'orders.csv'), csv([files.orders[0]!, files.orders[2]!]));
    await writeFile(
      path.join(directory, 'customers.csv'),
      csv([files.customers[0]!, files.customers[2]!]),
    );
    await ingestSales(directory);
    assert.equal(
      (await pool.query('SELECT count(*)::int AS count FROM sales.orders')).rows[0].count,
      1,
    );
    assert.equal(
      (
        await pool.query(
          'SELECT count(*)::int AS count FROM sales.order_items WHERE order_key IS NULL',
        )
      ).rows[0].count,
      5,
    );
    console.log(
      'OK: migración sin reescritura con lectores/escritores, idempotencia, duplicados, huérfanos, rollback, montos exactos, cursores, filtros y concurrencia HTTP.',
    );
  } finally {
    if (server)
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve())),
      );
    // Único directorio temporal creado por esta prueba.
    assert(path.resolve(directory).startsWith(path.join(os.tmpdir(), 'ecofor-orders-')));
    await rm(directory, { recursive: true, force: true });
    await pool.end();
  }
}

async function main() {
  if (process.argv.includes('--worker')) {
    await worker();
    return;
  }
  const name = `ecofor_test_${Date.now()}`;
  assert.match(name, /^ecofor_test_\d+$/);
  let created = false;
  try {
    await pool.query(`CREATE DATABASE "${name}"`);
    created = true;
    const env: NodeJS.ProcessEnv = { ...process.env, DB_NAME: name };
    if (env.DATABASE_URL) {
      const url = new URL(env.DATABASE_URL);
      url.pathname = `/${name}`;
      env.DATABASE_URL = url.toString();
    }
    const child = spawn(process.execPath, ['--import', 'tsx', __filename, '--worker'], {
      env,
      stdio: 'inherit',
    });
    const [code] = await once(child, 'exit');
    if (code !== 0) throw new Error(`Pruebas fallidas (código ${code})`);
  } finally {
    if (created) await pool.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await pool.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
