import assert from 'node:assert/strict';
import { once } from 'node:events';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { pool } from './db';
import { migrate } from './migrate';
import app from './app';
import type { Coupon } from './services/discount.service';
import type { calculateDiscounts } from './services/discount.service';
import type { OrderDetail } from './repositories/order.repository';
import { readJson } from './test-support/http';
import type { ErrorResponse, Page } from './test-support/http';

type DetailResponse = { data: OrderDetail };
type DiscountResponse = ReturnType<typeof calculateDiscounts>;
type CatalogResponse = Page<{ id: number; sku?: string }>;
interface ReportResponse {
  as_of: string;
  data: {
    customer_id: number;
    full_name: string;
    total_amount: string;
    order_count: number;
    average_ticket: string;
  }[];
}

const runFile = promisify(execFile);
async function worker() {
  assert.match(process.env.DB_NAME ?? '', /^ecofor_backend_test_\d+$/);
  await migrate();
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const address = server.address();
    assert(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    const customer = (
      await pool.query(`INSERT INTO sales.customers (email, full_name, city)
      VALUES ('test@example.cl','María Prueba','Santiago') RETURNING id`)
    ).rows[0].id as number;
    const productRows = (
      await pool.query(`INSERT INTO sales.products (sku, name, price, stock) VALUES
      ('ABC','Producto ABC',20.00,1000), ('XYZ','Producto XYZ',60.00,1000),
      ('RACE','Stock concurrente',1.99,37), ('EMPTY','Sin stock',5.00,0), ('DUP','Duplicado',1.00,1)
      RETURNING id, sku`)
    ).rows;
    const products = Object.fromEntries(productRows.map((row) => [row.sku, row.id])) as Record<
      string,
      number
    >;
    const request = async <T = CatalogResponse>(route: string, body?: unknown) => {
      const response = await fetch(
        base + route,
        body === undefined
          ? {}
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            },
      );
      assert.match(response.headers.get('content-type') ?? '', /application\/json/);
      return {
        status: response.status,
        data: await readJson<T>(response),
        location: response.headers.get('location'),
      };
    };
    const patchStock = (id: string | number, stock: unknown) =>
      fetch(base + '/api/catalog/products/' + id + '/stock', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock }),
      });
    const updatedStock = await patchStock(products.EMPTY!, 12);
    assert.equal(updatedStock.status, 200);
    assert.equal((await readJson<{ data: { stock: number } }>(updatedStock)).data.stock, 12);
    assert.equal(
      (await pool.query('SELECT stock FROM sales.products WHERE id=$1', [products.EMPTY])).rows[0]
        .stock,
      12,
    );
    for (const invalid of [-1, 1.5, '12', null, 2147483648])
      assert.equal((await patchStock(products.EMPTY!, invalid)).status, 400);
    assert.equal((await patchStock('invalid', 0)).status, 400);
    assert.equal((await patchStock(2147483647, 0)).status, 404);
    assert.equal((await patchStock(products.EMPTY!, 0)).status, 200);

    const index = await request<{ endpoints: { orders: string } }>('/');
    assert.equal(index.status, 200);
    assert.equal(index.data.endpoints.orders, '/orders');

    // Catálogos de creación: búsqueda remota literal, insensible a mayúsculas y paginada.
    assert.equal((await request('/api/customers?search=mAr%C3%ADa')).data.data[0]?.id, customer);
    assert.equal(
      (await request('/api/customers?search=TEST%40EXAMPLE')).data.data[0]?.id,
      customer,
    );
    assert.equal((await request('/api/catalog/products?search=pRoDuCtO')).data.data.length, 2);
    assert.equal(
      (await request('/api/catalog/products?search=aBc')).data.data[0]?.id,
      products.ABC,
    );
    const firstCatalog = await request('/api/catalog/products?search=producto&limit=1');
    assert.equal(firstCatalog.data.data[0]?.sku, 'ABC');
    assert.equal(firstCatalog.data.nextCursor, 'ABC');
    const lastCatalog = await request(
      `/api/catalog/products?search=producto&limit=1&after=${firstCatalog.data.nextCursor}`,
    );
    assert.equal(lastCatalog.data.data[0]?.sku, 'XYZ');
    assert.equal(lastCatalog.data.nextCursor, null);
    for (const path of ['/api/customers', '/api/catalog/products']) {
      for (const search of ['%25', '_', '%5C', '%27%20OR%20true--'])
        assert.equal((await request(`${path}?search=${search}`)).data.data.length, 0);
      for (const query of ['search=a&search=b', `search=${'a'.repeat(513)}`, 'limit=101'])
        assert.equal((await request(`${path}?${query}`)).status, 400);
    }
    console.log(
      'Catálogos: búsqueda por nombre/email/SKU, mayúsculas, caracteres literales, cursor y validación correctos.',
    );
    const stock = async (id: number) =>
      (await pool.query('SELECT stock FROM sales.products WHERE id=$1', [id])).rows[0].stock;
    const countOrders = async () =>
      (await pool.query('SELECT count(*)::integer AS count FROM sales.orders')).rows[0].count;

    // Smoke real con curl, sin shell intermedio ni comillas dependientes de PowerShell.
    const curl = process.platform === 'win32' ? 'curl.exe' : 'curl';
    const { stdout } = await runFile(curl, [
      '--silent',
      '--show-error',
      '--fail-with-body',
      '-H',
      'Content-Type: application/json',
      '--data-binary',
      JSON.stringify({
        customer_id: customer,
        items: [
          { product_id: products.ABC, quantity: 3 },
          { product_id: products.XYZ, quantity: 2 },
        ],
      }),
      '-w',
      '\n%{http_code}',
      `${base}/orders`,
    ]);
    const newline = stdout.lastIndexOf('\n');
    assert.equal(stdout.slice(newline + 1), '201');
    const created = JSON.parse(stdout.slice(0, newline)).data;
    assert.equal(created.status, 'pending');
    assert.equal(created.total, '180.00');
    assert.equal(created.items.length, 2);
    assert.equal(created.customer.id, customer);
    assert.equal(created.channel, 'web');
    assert(Date.now() - Date.parse(created.created_at) < 10000);
    assert.equal(await stock(products.ABC!), 997);
    assert.equal(await stock(products.XYZ!), 998);
    console.log(`curl POST /orders: 201, pedido con 2 ítems, total ${created.total}`);

    const beforeInvalid = await countOrders();
    for (const body of [
      null,
      [],
      {},
      { customer_id: '1', items: [] },
      { customer_id: customer, items: [] },
      { customer_id: customer, items: [null] },
      { customer_id: customer, items: [{ product_id: products.ABC, quantity: 0 }] },
      { customer_id: customer, items: [{ product_id: products.ABC, quantity: '1' }] },
      { customer_id: customer, items: [{ product_id: products.ABC, quantity: 1.5 }] },
      { customer_id: customer, items: [{ product_id: products.ABC, quantity: 1, unit_price: 0 }] },
      {
        customer_id: customer,
        items: [
          { product_id: products.ABC, quantity: 2147483647 },
          { product_id: products.ABC, quantity: 1 },
        ],
      },
    ])
      assert.equal((await request('/orders', body)).status, 400, JSON.stringify(body));
    assert.equal(await countOrders(), beforeInvalid);
    assert.equal(await stock(products.ABC!), 997);
    assert.equal(
      (
        await request('/orders', {
          customer_id: 2147483647,
          items: [{ product_id: products.ABC, quantity: 1 }],
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await request('/orders', {
          customer_id: customer,
          items: [
            { product_id: products.ABC, quantity: 1 },
            { product_id: 2147483647, quantity: 1 },
          ],
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await request('/orders', {
          customer_id: customer,
          items: [
            { product_id: products.ABC, quantity: 1 },
            { product_id: products.EMPTY, quantity: 1 },
          ],
        })
      ).status,
      409,
    );
    assert.equal(await stock(products.ABC!), 997);
    const malformed = await fetch(`${base}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad',
    });
    assert.equal(malformed.status, 400);
    assert.equal((await readJson<ErrorResponse>(malformed)).code, 'INVALID_JSON');
    const unsupported = await fetch(`${base}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: '{}',
    });
    assert.equal(unsupported.status, 415);
    assert.equal((await readJson<ErrorResponse>(unsupported)).code, 'UNSUPPORTED_MEDIA_TYPE');

    // Inyección de error al insertar un ítem: también revierte el UPDATE de stock y el pedido.
    await pool.query(`CREATE FUNCTION sales.reject_test_item() RETURNS trigger LANGUAGE plpgsql AS
      $$ BEGIN RAISE EXCEPTION 'Fallo controlado de prueba'; END $$;
      CREATE TRIGGER reject_test_item BEFORE INSERT ON sales.order_items FOR EACH ROW EXECUTE FUNCTION sales.reject_test_item()`);
    try {
      assert.equal(
        (
          await request('/orders', {
            customer_id: customer,
            items: [{ product_id: products.ABC, quantity: 1 }],
          })
        ).status,
        500,
      );
      assert.equal(await stock(products.ABC!), 997);
      assert.equal(await countOrders(), beforeInvalid);
    } finally {
      await pool.query(
        'DROP TRIGGER reject_test_item ON sales.order_items; DROP FUNCTION sales.reject_test_item()',
      );
    }

    // 100 conexiones HTTP lanzadas simultáneamente, sin semáforo del lado cliente.
    const raceStart = performance.now();
    const race = await Promise.all(
      Array.from({ length: 100 }, () =>
        request('/orders', {
          customer_id: customer,
          items: [{ product_id: products.RACE, quantity: 1 }],
        }),
      ),
    );
    assert.equal(race.filter((result) => result.status === 201).length, 37);
    assert.equal(race.filter((result) => result.status === 409).length, 63);
    assert.equal(await stock(products.RACE!), 0);
    assert.equal(await countOrders(), beforeInvalid + 37);
    assert.equal(
      (
        await pool.query(
          "SELECT sum(quantity)::integer AS sold FROM sales.order_items WHERE sku='RACE'",
        )
      ).rows[0].sold,
      37,
    );
    console.log(
      `100 solicitudes concurrentes: 37 respuestas 201, 63 respuestas 409, stock final 0 (${(performance.now() - raceStart).toFixed(1)} ms).`,
    );
    const duplicate = await request('/orders', {
      customer_id: customer,
      items: [
        { product_id: products.DUP, quantity: 1 },
        { product_id: products.DUP, quantity: 1 },
      ],
    });
    assert.equal(duplicate.status, 409);
    assert.equal(await stock(products.DUP!), 1);
    const opposite = await Promise.all(
      [
        ['ABC', 'XYZ'],
        ['XYZ', 'ABC'],
      ].map((skus) =>
        request('/orders', {
          customer_id: customer,
          items: skus.map((sku) => ({ product_id: products[sku], quantity: 1 })),
        }),
      ),
    );
    assert(opposite.every((result) => result.status === 201));

    // El precio del ítem permanece histórico tras modificar el catálogo.
    await pool.query("UPDATE sales.products SET price=99.99 WHERE sku='ABC'");
    assert.equal(
      (await request<DetailResponse>(`/orders/${created.id}`)).data.data.items[0]?.unit_price,
      '20.00',
    );
    assert.equal((await request('/orders/2147483647')).status, 404);
    assert.equal((await request('/orders/not-an-id')).status, 400);
    assert.equal((await request('/missing-route')).status, 404);
    assert.equal((await request('/orders')).data.data.length, 20);
    assert.equal((await request('/orders?customer=mAr%C3%ADa')).data.data.length, 20);
    assert.equal((await request('/orders?customer=%25')).data.data.length, 0);
    const ids: number[] = [];
    let cursor: string | null = null;
    do {
      const page: { status: number; data: CatalogResponse } = await request(
        `/orders?limit=7${cursor ? `&cursor=${cursor}` : ''}`,
      );
      assert.equal(page.status, 200);
      ids.push(...page.data.data.map((row: { id: number }) => row.id));
      cursor = page.data.nextCursor;
    } while (cursor);
    assert.equal(ids.length, await countOrders());
    assert.equal(new Set(ids).size, ids.length);
    for (const query of [
      'limit=101',
      'limit=0',
      'status=other',
      'from=2026-02-30',
      'cursor=broken',
      'customer[x]=bad',
    ]) {
      assert.equal((await request(`/orders?${query}`)).status, 400, query);
    }

    const coupons: Coupon[] = [
      { code: 'PROMO10', type: 'percentage', value: 10, stackable: true },
      { code: '3X2-ABC', type: 'n_for_m', sku: 'ABC', n: 3, m: 2, stackable: true },
    ];
    const beforeDiscount = (await request<DetailResponse>(`/orders/${created.id}`)).data;
    const preview = await request<DiscountResponse>(`/orders/${created.id}/apply-discounts`, {
      coupons,
    });
    assert.equal(preview.status, 200);
    assert.equal(preview.data.total_discount, '38.00');
    assert.equal(preview.data.items[0]?.discount, '26.00');
    assert.deepEqual((await request<DetailResponse>(`/orders/${created.id}`)).data, beforeDiscount);
    for (const badCoupons of [
      Array.from({ length: 31 }, (_, index) => ({ ...coupons[0], code: `C${index}` })),
      [coupons[0], coupons[0]],
      [{ ...coupons[0], value: 101 }],
      [{ ...coupons[0], stackable: 'false' }],
      [{ ...coupons[0], min_amount: -1 }],
      [{ ...coupons[0], applicable_skus: 'ABC' }],
      [{ ...coupons[1], n: 0 }],
      [{ ...coupons[1], m: 4 }],
      [{ ...coupons[1], m: 1.5 }],
      [{ code: 'F', type: 'fixed_amount', value: '0.001', stackable: true }],
      [null],
    ])
      assert.equal(
        (await request(`/orders/${created.id}/apply-discounts`, { coupons: badCoupons })).status,
        400,
      );
    assert.equal(
      (await request<DiscountResponse>(`/orders/${created.id}/apply-discounts`, { coupons: [] }))
        .data.total_discount,
      '0.00',
    );
    assert.equal((await request('/orders/2147483647/apply-discounts', { coupons })).status, 404);
    assert.equal(
      (
        await request('/orders/2147483647/apply-discounts', {
          coupons: Array.from({ length: 31 }, (_, index) => ({ ...coupons[0], code: `C${index}` })),
        })
      ).status,
      400,
      'Valida antes de buscar el pedido',
    );

    // Cota completa: 100 líneas y 30 cupones, con los tres tipos y condiciones.
    const large = await request<DetailResponse>('/orders', {
      customer_id: customer,
      items: Array.from({ length: 100 }, () => ({ product_id: products.ABC, quantity: 1 })),
    });
    assert.equal(large.status, 201);
    const thirty: Coupon[] = Array.from({ length: 30 }, (_, index) =>
      index % 3 === 0
        ? {
            code: `C${index}`,
            type: 'percentage',
            value: '12.345',
            stackable: true,
            applicable_skus: ['ABC'],
          }
        : index % 3 === 1
          ? {
              code: `C${index}`,
              type: 'fixed_amount',
              value: '15.01',
              stackable: index % 2 === 0,
              min_amount: '100.00',
            }
          : { code: `C${index}`, type: 'n_for_m', sku: 'ABC', n: 3, m: 2, stackable: true },
    );
    const times: number[] = [];
    for (let index = 0; index < 20; index++) {
      const started = performance.now();
      const result = await request<DiscountResponse>(
        `/orders/${large.data.data.id}/apply-discounts`,
        { coupons: thirty },
      );
      times.push(performance.now() - started);
      assert.equal(result.status, 200);
      assert.equal(result.data.items.length, 100);
    }
    const maximum = Math.max(...times);
    assert(maximum < 200, `La respuesta HTTP de descuentos tardó ${maximum.toFixed(1)} ms`);
    const sorted = [...times].sort((a, b) => a - b);
    console.log(
      `Descuentos 30 cupones / 100 ítems: 20 peticiones, p95 ${sorted[18]!.toFixed(1)} ms, máximo ${maximum.toFixed(1)} ms (HTTP local).`,
    );

    // Reporte aislado en una ventana antigua: incluye el límite inferior y excluye as_of.
    const reportCustomer = (
      await pool.query(`INSERT INTO sales.customers (email, full_name, city)
      VALUES ('report@example.cl','Cliente Reporte','Talca') RETURNING id`)
    ).rows[0].id;
    await pool.query(`INSERT INTO sales.orders (order_ref,customer_email,customer_key,status,created_at) VALUES
      ('REPORT-LOW','report@example.cl','report@example.cl','pending','2000-01-02T00:00:00Z'),
      ('REPORT-HIGH','report@example.cl','report@example.cl','paid','2000-01-31T23:59:59.999999Z'),
      ('REPORT-ZERO','report@example.cl','report@example.cl','shipped','2000-01-15T00:00:00Z'),
      ('REPORT-CANCEL','report@example.cl','report@example.cl','cancelled','2000-01-15T00:00:00Z'),
      ('REPORT-OUT','report@example.cl','report@example.cl','paid','2000-01-01T23:59:59.999999Z'),
      ('REPORT-ASOF','report@example.cl','report@example.cl','paid','2000-02-01T00:00:00Z');
      INSERT INTO sales.order_items (order_ref,order_key,sku,quantity,unit_price) VALUES
      ('REPORT-LOW','REPORT-LOW','ABC',2,10.00), ('REPORT-LOW','REPORT-LOW','XYZ',1,10.00),
      ('REPORT-HIGH','REPORT-HIGH','ABC',1,30.00), ('REPORT-CANCEL','REPORT-CANCEL','ABC',1,999.00),
      ('REPORT-OUT','REPORT-OUT','ABC',1,999.00), ('REPORT-ASOF','REPORT-ASOF','ABC',1,999.00)`);
    const report = await request<ReportResponse>('/reports/top-customers?as_of=2000-02-01');
    assert.equal(report.status, 200);
    assert.deepEqual(report.data.data, [
      {
        customer_id: reportCustomer,
        full_name: 'Cliente Reporte',
        total_amount: '60.00',
        order_count: 3,
        average_ticket: '20.00',
      },
    ]);
    assert.deepEqual(
      (await request<ReportResponse>('/reports/top-customers?as_of=2000-01-31T21:00:00-03:00'))
        .data,
      report.data,
    );
    assert.equal(
      (await request<ReportResponse>('/reports/top-customers?as_of=not-date')).status,
      400,
    );
    assert.equal(
      (await request<ReportResponse>('/reports/top-customers')).data.as_of.slice(0, 10),
      new Date().toISOString().slice(0, 10),
    );
    assert.equal(
      (await request('/orders?from=2000-01-02T00:00:00Z&to=2000-01-02T00:00:00Z')).data.data.length,
      1,
    );
    assert.equal((await request('/api/orders?limit=1')).status, 200);
    const curlReport = await runFile(curl, [
      '--silent',
      '--show-error',
      '--fail-with-body',
      `${base}/reports/top-customers?as_of=2000-02-01`,
    ]);
    assert.equal(JSON.parse(curlReport.stdout).data[0].average_ticket, '20.00');
    console.log(
      'curl GET /reports/top-customers: 200, monto 60.00, 3 pedidos, ticket promedio 20.00.',
    );
    await pool.query(`INSERT INTO sales.customers(email,full_name,city)
      SELECT 'ranking-'||n||'@example.cl','Ranking '||n,'Talca' FROM generate_series(1,12) n;
      INSERT INTO sales.orders(order_ref,customer_email,customer_key,status,created_at)
      SELECT 'RANK-'||n, 'ranking-'||n||'@example.cl', 'ranking-'||n||'@example.cl','paid','2000-01-15T00:00:00Z' FROM generate_series(1,12) n;
      INSERT INTO sales.order_items(order_ref,order_key,sku,quantity,unit_price)
      SELECT 'RANK-'||n,'RANK-'||n,'ABC',1,n FROM generate_series(1,12) n`);
    const topTen = (await request<ReportResponse>('/reports/top-customers?as_of=2000-02-01')).data
      .data;
    assert.equal(topTen.length, 10);
    assert.deepEqual(
      topTen.map((row: { total_amount: string }) => row.total_amount),
      ['60.00', '12.00', '11.00', '10.00', '9.00', '8.00', '7.00', '6.00', '5.00', '4.00'],
    );
    console.log(
      'OK: middleware, JSON/HTTP, stock, rollback, detalle histórico, fechas inclusivas, cursores, reporte y descuentos.',
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await pool.end();
  }
}

async function main() {
  if (process.argv.includes('--worker')) {
    await worker();
    return;
  }
  const name = `ecofor_backend_test_${Date.now()}`;
  assert.match(name, /^ecofor_backend_test_\d+$/);
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
    if (code !== 0) throw new Error(`Pruebas de backend fallidas (código ${code})`);
  } finally {
    if (created) await pool.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await pool.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
