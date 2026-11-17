
import pool from '../config/db.js';

export async function findTableById(tableId) {
  const [rows] = await pool.execute(
    'SELECT table_id, table_status FROM dining_table WHERE table_id = ?',
    [tableId],
  );

  return rows[0] ?? null;
}

/**
 * All tables with a summary of their current open session (admin table screen), in one query.
 * The open session is chosen the same way as findOpenSession (latest session with ended_at IS NULL),
 * independently of table_status, so the summary follows the real session even if table_status
 * disagrees with it. session is null when the table has no open session.
 * pending_count = orders not yet '전달 완료'. total_price = sum of the totals saved with each order.
 */
export async function findTablesWithSessionSummary() {
  const [rows] = await pool.query(
    `SELECT t.table_id, t.table_status, s.session_id, s.started_at,
            COUNT(o.order_id) AS order_count,
            CAST(COALESCE(SUM(o.order_status <> '전달 완료'), 0) AS SIGNED) AS pending_count,
            CAST(COALESCE(SUM(o.total_price), 0) AS SIGNED) AS total_price
     FROM dining_table t
     LEFT JOIN table_session s ON s.session_id = (
       SELECT MAX(open_s.session_id)
       FROM table_session open_s
       WHERE open_s.table_id = t.table_id AND open_s.ended_at IS NULL
     )
     LEFT JOIN orders o ON o.session_id = s.session_id
     GROUP BY t.table_id, t.table_status, s.session_id, s.started_at
     ORDER BY t.table_id`,
  );

  return rows.map((row) => ({
    table_id: row.table_id,
    table_status: row.table_status,
    session: row.session_id === null ? null : {
      session_id: row.session_id,
      started_at: row.started_at,
      order_count: row.order_count,
      pending_count: row.pending_count,
      total_price: row.total_price,
    },
  }));
}
