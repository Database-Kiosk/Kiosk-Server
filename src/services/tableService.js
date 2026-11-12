
import pool from '../config/db.js';

export async function findTableById(tableId) {
  const [rows] = await pool.execute(
    'SELECT table_id, table_status FROM dining_table WHERE table_id = ?',
    [tableId],
  );

  return rows[0] ?? null;
}
