import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { Pool } from 'pg';
import { pool } from './db';

export const MAINTENANCE_LOCK = '724819351';

export async function migrate(database: Pool = pool, through?: string) {
  const client = await database.connect();
  let locked = false;
  try {
    const version = await client.query('SHOW server_version_num');
    if (Number(version.rows[0].server_version_num) < 150000)
      throw new Error('Se requiere PostgreSQL 15 o superior');
    locked = (await client.query('SELECT pg_try_advisory_lock($1) AS locked', [MAINTENANCE_LOCK]))
      .rows[0].locked;
    if (!locked) throw new Error('Hay otra migración o ingesta en ejecución');
    await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const directory = path.resolve(__dirname, '../migrations');
    const files = (await readdir(directory)).filter((file) => /^\d{3}_.+\.sql$/.test(file)).sort();
    if (through && !files.includes(through)) throw new Error(`Migración desconocida: ${through}`);
    for (const file of files) {
      const sql = (await readFile(path.join(directory, file), 'utf8')).replace(/\r\n/g, '\n');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const applied = await client.query(
        'SELECT checksum FROM public.schema_migrations WHERE version = $1',
        [file],
      );
      if (applied.rowCount) {
        if (applied.rows[0].checksum !== checksum)
          throw new Error(`Migración aplicada modificada: ${file}`);
      } else {
        for (let attempt = 0; ; attempt++) {
          try {
            await client.query('BEGIN');
            await client.query(
              "SET LOCAL lock_timeout = '1s'; SET LOCAL statement_timeout = '30s'",
            );
            await client.query(sql);
            await client.query(
              'INSERT INTO public.schema_migrations (version, checksum) VALUES ($1, $2)',
              [file, checksum],
            );
            await client.query('COMMIT');
            console.log(`Migración aplicada: ${file}`);
            break;
          } catch (error) {
            await client.query('ROLLBACK');
            if ((error as { code?: string }).code !== '55P03' || attempt >= 7) throw error;
            console.log(`Lock ocupado para ${file}; reintento ${attempt + 1}/7`);
            await delay(250 * (attempt + 1) + Math.random() * 250);
          }
        }
      }
      if (file === through) break;
    }
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock($1)', [MAINTENANCE_LOCK]);
    client.release();
  }
}

if (require.main === module) {
  const through = process.argv.find((arg) => arg.startsWith('--through='))?.split('=')[1];
  migrate(pool, through)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
