import { createReadStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { from as copyFrom } from 'pg-copy-streams';
import { pool } from './db';

async function main() {
  const client = await pool.connect();
  try {
    for (const [table, columns] of Object.entries({
      customers: ['email', 'full_name', 'city'],
      products: ['sku', 'name', 'price', 'stock'],
      orders: ['order_ref', 'customer_email', 'status', 'created_at'],
      order_items: ['order_ref', 'sku', 'quantity', 'unit_price'],
    })) {
      await client.query(
        `CREATE TEMP TABLE raw_${table} (${columns.map((c) => `${c} TEXT`).join(',')})`,
      );
      await pipeline(
        createReadStream(path.resolve(__dirname, `../../data/${table}.csv`)),
        client.query(
          copyFrom(`COPY raw_${table} FROM STDIN (FORMAT csv, HEADER MATCH, ENCODING 'UTF8')`),
        ),
      );
      await client.query(`ANALYZE raw_${table}`);
      console.log(table, (await client.query(`SELECT count(*) AS rows FROM raw_${table}`)).rows[0]);
    }
    for (const [name, sql] of Object.entries({
      duplicates: `SELECT (SELECT count(*)-count(DISTINCT email) FROM raw_customers) AS customers,
        (SELECT count(*)-count(DISTINCT sku) FROM raw_products) AS products,
        (SELECT count(*)-count(DISTINCT order_ref) FROM raw_orders) AS orders`,
      orphan_orders: `SELECT count(*) FROM raw_orders o WHERE NOT EXISTS (SELECT 1 FROM raw_customers c WHERE c.email=o.customer_email)`,
      orphan_items_order: `SELECT count(*) FROM raw_order_items i WHERE NOT EXISTS (SELECT 1 FROM raw_orders o WHERE o.order_ref=i.order_ref)`,
      orphan_items_sku: `SELECT count(*) FROM raw_order_items i WHERE NOT EXISTS (SELECT 1 FROM raw_products p WHERE p.sku=i.sku)`,
      statuses: `SELECT status,count(*) FROM raw_orders GROUP BY status`,
      invalid_products: `SELECT count(*) FROM raw_products WHERE sku IS NULL OR name IS NULL OR price IS NULL OR stock IS NULL
        OR price !~ '^[0-9]+[.][0-9]{2}$' OR stock !~ '^[0-9]+$'`,
      invalid_items: `SELECT count(*) FROM raw_order_items WHERE order_ref IS NULL OR sku IS NULL OR quantity IS NULL OR unit_price IS NULL
        OR quantity !~ '^[1-9][0-9]*$' OR unit_price !~ '^[0-9]+[.][0-9]{2}$'`,
      invalid_customers: `SELECT count(*) FROM raw_customers WHERE email IS NULL OR full_name IS NULL OR city IS NULL`,
      invalid_orders: `SELECT count(*) FROM raw_orders WHERE order_ref IS NULL OR customer_email IS NULL OR created_at IS NULL
        OR created_at !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]+)?Z$'`,
    }))
      console.log(name, (await client.query(sql)).rows);
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
