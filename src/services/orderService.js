import pool from '../config/db.js';
import { findTableById } from './tableService.js';
import { findOpenSession, getOrOpenSession } from './tableSessionService.js';

// Largest value an INT column (orders.total_price etc.) can hold.
const MAX_INT_COLUMN = 2147483647;

// Error with an HTTP status. The common error handler in app.js responds with { message }.
function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

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

// Orders of one session, newest first, each with its items and options.
// Three queries in total (orders, items, options), all filtered by session_id, so the number of
// queries does not grow with the number of orders (no N+1) and no long IN (...) list is needed.
// Prices are the ones saved at order time; names come from menu / menu_option (no is_active filter,
// so menus taken off sale still show up in past orders).
//
// Consistency without a transaction: an order and all of its items/options are committed together
// and never changed afterwards (only order_status can change), so every order read by the first
// query has all of its rows visible to the later queries. Rows of orders committed after the first
// query are skipped; they appear on the next request.
async function findOrdersBySession(sessionId) {
  const [orders] = await pool.execute(
    `SELECT order_id, order_status, order_time, total_price
     FROM orders
     WHERE session_id = ?
     ORDER BY order_id DESC`,
    [sessionId],
  );
  if (orders.length === 0) return [];

  const [details] = await pool.execute(
    `SELECT d.order_detail_id, d.order_id, d.menu_id, m.menu_name, d.quantity, d.unit_price
     FROM orderdetail d
     JOIN orders o ON o.order_id = d.order_id
     JOIN menu m ON m.menu_id = d.menu_id
     WHERE o.session_id = ?
     ORDER BY d.order_detail_id`,
    [sessionId],
  );

  const [options] = await pool.execute(
    `SELECT oo.order_detail_id, oo.option_id, mo.option_name, oo.extra_price
     FROM orderoption oo
     JOIN orderdetail d ON d.order_detail_id = oo.order_detail_id
     JOIN orders o ON o.order_id = d.order_id
     JOIN menu_option mo ON mo.option_id = oo.option_id
     WHERE o.session_id = ?
     ORDER BY oo.order_detail_id, oo.option_id`,
    [sessionId],
  );

  const optionsByDetailId = new Map();
  for (const { order_detail_id: detailId, ...option } of options) {
    if (!optionsByDetailId.has(detailId)) optionsByDetailId.set(detailId, []);
    optionsByDetailId.get(detailId).push(option);
  }

  const itemsByOrderId = new Map(orders.map((order) => [order.order_id, []]));
  for (const { order_id: orderId, ...item } of details) {
    // Missing for an order committed after the first query: skipped (see above).
    itemsByOrderId.get(orderId)?.push({ ...item, options: optionsByDetailId.get(item.order_detail_id) ?? [] });
  }

  return orders.map((order) => ({ ...order, items: itemsByOrderId.get(order.order_id) }));
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
