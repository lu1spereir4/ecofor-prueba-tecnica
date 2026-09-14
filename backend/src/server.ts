import 'dotenv/config';

import app from './app';
import { pool } from './db';

const PORT = Number(process.env.PORT ?? 3000);

async function startServer() {
  try {
    await pool.query('SELECT 1');

    console.log('Conexión PostgreSQL correcta');

    app.listen(PORT, () => {
      console.log(`API ejecutándose en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar el servidor:', error);

    process.exit(1);
  }
}

startServer();
