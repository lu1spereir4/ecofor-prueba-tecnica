import { config } from 'dotenv';
import path from 'node:path';
import { Pool } from 'pg';

config({ path: path.resolve(__dirname, '../.env'), quiet: true });

export const pool = new Pool({
  ...(process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT ?? 5432),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      }),
  application_name: 'ecofor',
  connectionTimeoutMillis: 5000,
});
