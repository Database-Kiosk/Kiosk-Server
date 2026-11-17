import pool from '../config/db.js';

/**
 * 테이블의 활성 세션을 조회하고, 없으면 새로 생성한다.
 *
 * 호출 조건:
 * 1. 주문 서비스에서 트랜잭션을 시작해야 한다.
 * 2. 해당 dining_table 행을 FOR UPDATE로 잠근 상태여야 한다.
 * 3. 주문 저장과 동일한 connection을 전달해야 한다.
 *
 * commit, rollback, release는 호출한 주문 서비스에서 처리한다.
 */
export async function getOrOpenSession(connection, table) {
  // 종료 시간이 없는 세션을 현재 이용 중인 세션으로 판단한다.
  const [sessions] = await connection.execute(
    `SELECT session_id
     FROM table_session
     WHERE table_id = ? AND ended_at IS NULL
     ORDER BY session_id DESC
     LIMIT 1
     FOR UPDATE`,
    [table.table_id],
  );

  let sessionId = sessions[0]?.session_id;

  // 활성 세션이 없으면 첫 주문이므로 새 세션을 생성한다.
  if (!sessionId) {
    const [result] = await connection.execute(
      'INSERT INTO table_session (table_id) VALUES (?)',
      [table.table_id],
    );

    sessionId = result.insertId;
  }

  // 세션을 사용하는 테이블은 이용 중 상태로 변경한다.
  if (table.table_status !== '이용 중') {
    await connection.execute(
      "UPDATE dining_table SET table_status = '이용 중' WHERE table_id = ?",
      [table.table_id],
    );
  }

  return sessionId;
}

/**
 * 테이블의 현재 열린 세션을 조회한다. (주문 내역 조회용, 읽기 전용)
 *
 * getOrOpenSession과 같은 기준(종료 시간이 없는 가장 최근 세션)을 사용하므로
 * 주문 생성과 조회가 같은 세션을 가리킨다.
 * 세션을 생성하거나 잠그지 않으며, 열린 세션이 없으면 null을 반환한다.
 */
export async function findOpenSession(tableId) {
  const [sessions] = await pool.execute(
    `SELECT session_id, started_at
     FROM table_session
     WHERE table_id = ? AND ended_at IS NULL
     ORDER BY session_id DESC
     LIMIT 1`,
    [tableId],
  );

  return sessions[0] ?? null;
}
