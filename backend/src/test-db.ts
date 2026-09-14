import { pool } from './db';

async function main() {
  try {
    const result = await pool.query('SELECT current_database(), current_user, NOW()');

    console.log(result.rows[0]);
  } catch (error) {
    console.error('Error conectando a PostgreSQL:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
