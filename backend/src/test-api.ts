import assert from 'node:assert/strict';
import { once } from 'node:events';
import app from './app';
import { pool } from './db';
import { readJson } from './test-support/http';

interface InventoryResponse {
  count: number;
  data: { id: string; stock: number }[];
}

async function main() {
  const server = app.listen(0, '127.0.0.1');
  let productId: string | undefined;
  try {
    await once(server, 'listening');
    const address = server.address();
    assert(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    const code = `TEST-${Date.now()}`;
    const inserted = await pool.query(
      `INSERT INTO products (codigo,nombre,categoria,precio,stock,fecha_actualizacion)
       VALUES ($1,'Producto de prueba','Prueba API',1000,5,CURRENT_DATE) RETURNING id`,
      [code],
    );
    productId = inserted.rows[0].id;
    assert.equal((await fetch(`${base}/health`)).status, 200);
    const list = await readJson<InventoryResponse>(
      await fetch(`${base}/api/products?search=${code}&category=Prueba%20API`),
    );
    assert.equal(list.count, 1);
    assert.equal(list.data[0]?.id, productId);
    const empty = await readJson<InventoryResponse>(
      await fetch(`${base}/api/products?search=${code}&category=Otra`),
    );
    assert.equal(empty.count, 0);
    const patch = (stock: unknown, id = productId) =>
      fetch(`${base}/api/products/${id}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock }),
      });
    const updated = await patch(12);
    assert.equal(updated.status, 200);
    assert.equal((await readJson<{ data: { stock: number } }>(updated)).data.stock, 12);
    assert.equal(
      (await pool.query('SELECT stock FROM products WHERE id=$1', [productId])).rows[0].stock,
      12,
    );
    for (const invalid of [-1, 1.5, '', '12', null, 2147483648]) {
      assert.equal((await patch(invalid)).status, 400, `Stock inválido: ${invalid}`);
    }
    assert.equal((await patch(1, '0')).status, 400);
    console.log(
      'API verificada: health, búsqueda, categoría, sin resultados, stock persistido y validación.',
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    try {
      if (productId) await pool.query('DELETE FROM products WHERE id=$1', [productId]);
    } finally {
      await pool.end();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
