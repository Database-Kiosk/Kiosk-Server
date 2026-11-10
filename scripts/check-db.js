// Standalone MySQL connection test: npm run db:check
import env from '../src/config/env.js';
import pool, { describeDbError } from '../src/config/db.js';
import { getDatabaseStatus } from '../src/services/healthService.js';

console.log(`[db:check] Connecting to ${env.db.user}@${env.db.host}:${env.db.port}/${env.db.database} ...`);

try {
  const db = await getDatabaseStatus();
  console.log('[db:check] Connection OK');
  console.log(`  MySQL version : ${db.version}`);
  console.log(`  Database      : ${db.database}`);
  console.log(`  Time zone     : ${db.timeZone}`);
  console.log(`  Tables (${db.tables.length})   : ${db.tables.join(', ') || '(none)'}`);
  process.exitCode = 0;
} catch (err) {
  const { code, hint, detail } = describeDbError(err);
  console.error(`[db:check] Connection FAILED (${code})`);
  console.error(`  ${hint}`);
  console.error(`  Detail: ${detail}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
