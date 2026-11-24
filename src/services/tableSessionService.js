import pool from '../config/db.js';
import { httpError } from '../utils/httpError.js';

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

/**
 * 활성 세션을 종료하고 테이블을 이용 가능 상태로 변경한다.
 */
export async function completeTableSession(tableId) {
  const connection = await pool.getConnection();

  try {
    // 기존 주문 생성 서비스와 같은 격리 수준을 사용한다.
    await connection.query(
      'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
    );
    await connection.beginTransaction();

    // 1. 테이블 확인 및 잠금
    const [tables] = await connection.execute(
      `SELECT table_id, table_status
       FROM dining_table
       WHERE table_id = ?
       FOR UPDATE`,
      [tableId],
    );

    if (tables.length === 0) {
      throw httpError(404, '존재하지 않는 테이블입니다.');
    }

    // 2. 활성 세션 확인
    const [sessions] = await connection.execute(
      `SELECT session_id
       FROM table_session
       WHERE table_id = ? AND ended_at IS NULL
       ORDER BY session_id DESC
       FOR UPDATE`,
      [tableId],
    );

    if (sessions.length === 0) {
      throw httpError(409, '현재 이용 중인 세션이 없습니다.');
    }

    // 정상적으로는 테이블당 활성 세션이 하나여야 한다.
    if (sessions.length > 1) {
      throw httpError(
        409,
        '활성 세션이 여러 개여서 이용을 종료할 수 없습니다.',
      );
    }

    if (tables[0].table_status !== '이용 중') {
      throw httpError(
        409,
        '테이블 상태와 활성 세션 정보가 일치하지 않습니다.',
      );
    }

    const sessionId = sessions[0].session_id;

    // 3. 현재 세션에 미완료 주문이 있는지 확인
    const [pendingOrders] = await connection.execute(
      `SELECT order_id
       FROM orders
       WHERE session_id = ?
         AND order_status <> '전달 완료'
       LIMIT 1
       FOR UPDATE`,
      [sessionId],
    );

    if (pendingOrders.length > 0) {
      throw httpError(
        409,
        '처리 중인 주문이 있어 테이블 이용을 종료할 수 없습니다.',
      );
    }

    // 4. 세션 종료 시간 기록
    await connection.execute(
      `UPDATE table_session
       SET ended_at = NOW()
       WHERE session_id = ? AND ended_at IS NULL`,
      [sessionId],
    );

    // 5. 테이블 상태 변경
    await connection.execute(
      `UPDATE dining_table
       SET table_status = '이용 가능'
       WHERE table_id = ?`,
      [tableId],
    );

    // 두 변경이 모두 성공한 경우에만 반영한다.
    await connection.commit();

    return {
      table_id: tableId,
      table_status: '이용 가능',
      session: null,
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // rollback 실패로 원래 오류가 덮이지 않도록 한다.
    }

    throw error;
  } finally {
    connection.release();
  }
}