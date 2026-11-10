import pool, { checkConnection } from '../config/db.js';

// Returns basic information about the connected MySQL database.
export async function getDatabaseStatus() {
  await checkConnection();

  const [[info]] = await pool.query(
    'SELECT VERSION() AS version, DATABASE() AS name, @@session.time_zone AS timeZone',
  );
  const [tables] = await pool.query(
    `SELECT TABLE_NAME AS name
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME`,
  );

  return {
    version: info.version,
    database: info.name,
    timeZone: info.timeZone,
    tables: tables.map((row) => row.name),
  };
}
