import app from './app.js';
import env from './config/env.js';
import pool, { checkConnection } from './config/db.js';

const server = app.listen(env.port, async () => {
  console.log(`[server] Listening on http://localhost:${env.port}`);

  try {
    await checkConnection();
    console.log(`[db] Connected to MySQL (${env.db.host}:${env.db.port}/${env.db.database})`);
  } catch (err) {
    console.error(`[db] Connection failed: ${err.code || ''} ${err.message}`);
  }
});

async function shutdown(signal) {
  console.log(`[server] ${signal} received, shutting down...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
