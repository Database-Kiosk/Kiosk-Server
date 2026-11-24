import pool from '../config/db.js';
import { findTableById } from './tableService.js';
import { findOpenSession, getOrOpenSession } from './tableSessionService.js';
import { httpError } from '../utils/httpError.js';

// orders.order_status ENUM values (DB/schema.sql), in the order a status moves forward.
export const ORDER_STATUSES = ['접수', '조리 중', '전달 완료'];

// 400 message for an order_status / status value that is not one of ORDER_STATUSES.
export const ORDER_STATUS_ERROR_MESSAGE = `주문 상태는 ${ORDER_STATUSES.join(', ')} 중 하나로 입력하세요.`;

// Largest value an INT column (orders.total_price etc.) can hold.
const MAX_INT_COLUMN = 2147483647;

// "?, ?, ?" for an IN (...) list, so the values stay bound parameters.
const placeholders = (values) => values.map(() => '?').join(', ');

// Loads the ordered menus and options, checks them, and computes prices from the DB only.
// FOR SHARE: the rows cannot be changed by another transaction until this order commits,
// so the saved prices are exactly the prices at order time.
async function priceItems(connection, items) {
  const menuIds = [...new Set(items.map((item) => item.menuId))];
  const [menuRows] = await connection.execute(
    `SELECT menu_id, menu_name, price, is_active
     FROM menu
     WHERE menu_id IN (${placeholders(menuIds)})
     FOR SHARE`,
    menuIds,
  );
  const menus = new Map(menuRows.map((menu) => [menu.menu_id, menu]));

  for (const menuId of menuIds) {
    if (menus.get(menuId)?.is_active !== 1) {
      throw httpError(409, '주문할 수 없는 메뉴가 포함되어 있습니다. 메뉴를 다시 확인해 주세요.');
    }
  }

  const optionIds = [...new Set(items.flatMap((item) => item.optionIds))];
  const options = new Map();
  if (optionIds.length > 0) {
    const [optionRows] = await connection.execute(
      `SELECT option_id, menu_id, option_name, additional_price
       FROM menu_option
       WHERE option_id IN (${placeholders(optionIds)})
       FOR SHARE`,
      optionIds,
    );
    optionRows.forEach((option) => options.set(option.option_id, option));
  }

  let totalPrice = 0;
  const pricedItems = items.map((item) => {
    const menu = menus.get(item.menuId);
    const itemOptions = [...item.optionIds].sort((a, b) => a - b).map((optionId) => {
      const option = options.get(optionId);
      if (!option || option.menu_id !== item.menuId) {
        throw httpError(400, '선택한 옵션이 해당 메뉴의 옵션이 아닙니다.');
      }
      return {
        option_id: option.option_id,
        option_name: option.option_name,
        extra_price: option.additional_price,
      };
    });

    // 항목 금액 = (메뉴 기본 가격 + 옵션 추가금액 합계) × 수량
    const unitTotal = itemOptions.reduce((sum, option) => sum + option.extra_price, menu.price);
    const lineTotal = unitTotal * item.quantity;
    totalPrice += lineTotal;
    if (!Number.isSafeInteger(totalPrice) || totalPrice > MAX_INT_COLUMN) {
      throw httpError(400, '주문 금액이 허용 범위를 초과했습니다.');
    }

    return {
      menu_id: menu.menu_id,
      menu_name: menu.menu_name,
      quantity: item.quantity,
      unit_price: menu.price,
      options: itemOptions,
    };
  });

  return { totalPrice, pricedItems };
}

/**
 * Creates an order in one transaction: table lock → menu/option check and prices → session (open if
 * needed) → save. Any error rolls back everything, including a newly opened session and the table
 * status change.
 * @param {{ tableId: number, items: { menuId: number, optionIds: number[], quantity: number }[] }} order
 */
export async function createOrder({ tableId, items }) {
  const connection = await pool.getConnection();
  try {
    // READ COMMITTED for this transaction only (applies to the next transaction on this connection;
    // the DB default is unchanged). Locking reads then take record locks only, no gap locks:
    // under REPEATABLE READ, first orders on different tables deadlocked on INSERT table_session.
    await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await connection.beginTransaction();

    // Lock the table row: orders for the same table run one at a time.
    const [tables] = await connection.execute(
      'SELECT table_id, table_status FROM dining_table WHERE table_id = ? FOR UPDATE',
      [tableId],
    );
    if (tables.length === 0) {
      throw httpError(404, '존재하지 않는 테이블입니다.');
    }

    const { totalPrice, pricedItems } = await priceItems(connection, items);
    const sessionId = await getOrOpenSession(connection, tables[0]);

    // order_status uses the column default ('접수').
    const [orderResult] = await connection.execute(
      'INSERT INTO orders (total_price, session_id) VALUES (?, ?)',
      [totalPrice, sessionId],
    );
    const orderId = orderResult.insertId;

    // One row per item (also when the same menu/options appear twice), saving the prices at order time.
    for (const item of pricedItems) {
      const [detailResult] = await connection.execute(
        'INSERT INTO orderdetail (order_id, menu_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [orderId, item.menu_id, item.quantity, item.unit_price],
      );
      for (const option of item.options) {
        await connection.execute(
          'INSERT INTO orderoption (order_detail_id, option_id, extra_price) VALUES (?, ?, ?)',
          [detailResult.insertId, option.option_id, option.extra_price],
        );
      }
    }

    const [[savedOrder]] = await connection.execute(
      'SELECT order_id, order_status, order_time, total_price FROM orders WHERE order_id = ?',
      [orderId],
    );

    await connection.commit();

    return {
      order_id: savedOrder.order_id,
      table_id: tableId,
      order_status: savedOrder.order_status,
      order_time: savedOrder.order_time,
      total_price: savedOrder.total_price,
      items: pricedItems,
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Keep the original error; a failed rollback (e.g. lost connection) ends the transaction anyway.
    }
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Orders matching a condition, newest first, each with its items and options.
 * `where` is an SQL condition on the aliases o (orders) and s (table_session) with ? placeholders only;
 * values always go in `params`. An empty `where` means all orders.
 *
 * Three queries in total (orders, items, options), all filtered by the same condition, so the number
 * of queries does not grow with the number of orders (no N+1) and no long IN (...) list is needed.
 * Prices are the ones saved at order time; names come from menu / menu_option (no is_active filter,
 * so menus taken off sale still show up in past orders).
 *
 * The three queries run in one read-only REPEATABLE READ transaction (consistent snapshot), so they
 * see the same rows even if an order is added or its order_status changes in between (a status
 * filter would otherwise drop the items of an order whose status changed after the first query).
 */
async function findOrdersWhere(where, params) {
  const whereSql = where ? `WHERE ${where}` : '';
  const connection = await pool.getConnection();
  try {
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');

    const [orders] = await connection.execute(
      `SELECT o.order_id, o.session_id, s.table_id, o.order_status, o.order_time, o.total_price
       FROM orders o
       JOIN table_session s ON s.session_id = o.session_id
       ${whereSql}
       ORDER BY o.order_id DESC`,
      params,
    );
    if (orders.length === 0) {
      await connection.commit();
      return [];
    }

    const [details] = await connection.execute(
      `SELECT d.order_detail_id, d.order_id, d.menu_id, m.menu_name, d.quantity, d.unit_price
       FROM orderdetail d
       JOIN orders o ON o.order_id = d.order_id
       JOIN table_session s ON s.session_id = o.session_id
       JOIN menu m ON m.menu_id = d.menu_id
       ${whereSql}
       ORDER BY d.order_detail_id`,
      params,
    );

    const [options] = await connection.execute(
      `SELECT oo.order_detail_id, oo.option_id, mo.option_name, oo.extra_price
       FROM orderoption oo
       JOIN orderdetail d ON d.order_detail_id = oo.order_detail_id
       JOIN orders o ON o.order_id = d.order_id
       JOIN table_session s ON s.session_id = o.session_id
       JOIN menu_option mo ON mo.option_id = oo.option_id
       ${whereSql}
       ORDER BY oo.order_detail_id, oo.option_id`,
      params,
    );

    await connection.commit();
    return groupOrders(orders, details, options);
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Keep the original error.
    }
    throw error;
  } finally {
    connection.release();
  }
}

// Puts options under their item and items under their order.
function groupOrders(orders, details, options) {

  const optionsByDetailId = new Map();
  for (const { order_detail_id: detailId, ...option } of options) {
    if (!optionsByDetailId.has(detailId)) optionsByDetailId.set(detailId, []);
    optionsByDetailId.get(detailId).push(option);
  }

  const itemsByOrderId = new Map(orders.map((order) => [order.order_id, []]));
  for (const { order_id: orderId, ...item } of details) {
    itemsByOrderId.get(orderId).push({ ...item, options: optionsByDetailId.get(item.order_detail_id) ?? [] });
  }

  return orders.map((order) => ({ ...order, items: itemsByOrderId.get(order.order_id) }));
}

// Orders of one session for the customer history API. Keeps that API's response shape
// (no session_id / table_id per order; both are already at the top level of the response).
async function findOrdersBySession(sessionId) {
  const orders = await findOrdersWhere('o.session_id = ?', [sessionId]);
  // eslint-disable-next-line no-unused-vars
  return orders.map(({ session_id, table_id, ...order }) => order);
}

/**
 * All orders for the admin screen, newest first. Orders of ended sessions are included.
 * Every filter is optional and they are combined with AND.
 * date: 'YYYY-MM-DD' (already validated). order_time is a DATETIME saved in the DB time zone, so the day
 * is compared as-is on the DB side: [date 00:00:00, next day 00:00:00).
 * @param {{ date?: string, status?: string, tableId?: number }} filters
 */
export async function findOrders({ date, status, tableId } = {}) {
  const conditions = [];
  const params = [];
  if (date !== undefined) {
    conditions.push('o.order_time >= CAST(? AS DATE) AND o.order_time < CAST(? AS DATE) + INTERVAL 1 DAY');
    params.push(date, date);
  }
  if (status !== undefined) {
    conditions.push('o.order_status = ?');
    params.push(status);
  }
  if (tableId !== undefined) {
    conditions.push('s.table_id = ?');
    params.push(tableId);
  }
  return findOrdersWhere(conditions.join(' AND '), params);
}

/**
 * One order with its table/session information, items and options.
 * @param {number} orderId
 * @returns {Promise<object|null>} null if the order does not exist
 */
export async function findOrderById(orderId) {
  const [order] = await findOrdersWhere('o.order_id = ?', [orderId]);
  if (!order) return null;

  // orders.session_id is a NOT NULL foreign key, so the session row always exists.
  const [[session]] = await pool.execute(
    'SELECT started_at, ended_at FROM table_session WHERE session_id = ?',
    [order.session_id],
  );
  const { items, ...base } = order;
  return {
    ...base,
    session: { session_id: order.session_id, started_at: session.started_at, ended_at: session.ended_at },
    items,
  };
}

/**
 * Moves an order one step forward (접수 → 조리 중 → 전달 완료) and returns the full order.
 * The order row is locked (FOR UPDATE) while its current status is checked, so two admins changing the
 * same order at once run one after another: the second sees the new status and gets 409.
 * The same status, a previous status or skipping a step is 409. Orders of ended sessions are not restricted.
 * @param {number} orderId
 * @param {string} nextStatus one of ORDER_STATUSES (already validated)
 * @returns {Promise<object>} same shape as findOrderById
 */
export async function updateOrderStatus(orderId, nextStatus) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [orders] = await connection.execute(
      'SELECT order_status FROM orders WHERE order_id = ? FOR UPDATE',
      [orderId],
    );
    if (orders.length === 0) {
      throw httpError(404, '존재하지 않는 주문입니다.');
    }

    const currentIndex = ORDER_STATUSES.indexOf(orders[0].order_status);
    if (ORDER_STATUSES.indexOf(nextStatus) !== currentIndex + 1) {
      throw httpError(409, '변경할 수 없는 주문 상태입니다.');
    }

    await connection.execute('UPDATE orders SET order_status = ? WHERE order_id = ?', [nextStatus, orderId]);
    await connection.commit();
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Keep the original error.
    }
    throw error;
  } finally {
    connection.release();
  }

  // Orders are never deleted, so the order still exists after the commit.
  return findOrderById(orderId);
}

/**
 * Order history of the table's current (open) session. Read only: never opens a session or locks rows.
 * Orders of ended sessions are never returned, because only the open session is looked up.
 * @param {number} tableId
 * @returns {Promise<object|null>} null if the table does not exist; orders is [] without an open session
 */
export async function findCurrentTableOrders(tableId) {
  const table = await findTableById(tableId);
  if (!table) return null;

  const session = await findOpenSession(tableId);
  const orders = session ? await findOrdersBySession(session.session_id) : [];

  return {
    table_id: tableId,
    session_id: session?.session_id ?? null,
    started_at: session?.started_at ?? null,
    // Sum of the totals saved with each order.
    total_price: orders.reduce((sum, order) => sum + order.total_price, 0),
    orders,
  };
}
