import app from './app.js';
import env, { validateAuthConfig } from './config/env.js';
import pool, { checkConnection, describeDbError } from './config/db.js';

const authConfigError = validateAuthConfig();
if (authConfigError) {
  console.error(`[auth] ${authConfigError}`);
  console.error('[auth] Server not started.');
  process.exit(1);
}

const server = app.listen(env.port, async () => {
  console.log(`[server] Listening on http://localhost:${env.port}`);

  try {
    await checkConnection();
    console.log(`[db] Connected to MySQL (${env.db.host}:${env.db.port}/${env.db.database})`);
  } catch (err) {
    const { code, hint, detail } = describeDbError(err);
    console.error(`[db] Connection failed (${code}): ${hint}`);
    console.error(`[db] Detail: ${detail}`);
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
