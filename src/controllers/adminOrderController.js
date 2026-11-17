import { ORDER_STATUSES, findOrders, findOrderById, updateOrderStatus } from '../services/orderService.js';

const STATUS_ERROR_MESSAGE = `주문 상태는 ${ORDER_STATUSES.join(', ')} 중 하나로 입력하세요.`;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const isPositiveId = (value) => Number.isSafeInteger(value) && value > 0;

// 'YYYY-MM-DD' that is a real calendar date (rejects e.g. 2026-02-30).
function isValidDate(value) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// Returns { filters } or { error } for the optional query parameters date, status, table_id.
// A repeated parameter (?status=a&status=b) arrives as an array and is rejected.
function parseOrderFilters(query) {
  const { date, status, table_id: tableIdParam } = query;
  const filters = {};

  if (date !== undefined) {
    if (typeof date !== 'string' || !isValidDate(date)) {
      return { error: '날짜는 YYYY-MM-DD 형식으로 입력하세요.' };
    }
    filters.date = date;
  }
  if (status !== undefined) {
    if (typeof status !== 'string' || !ORDER_STATUSES.includes(status)) {
      return { error: STATUS_ERROR_MESSAGE };
    }
    filters.status = status;
  }
  if (tableIdParam !== undefined) {
    const tableId = typeof tableIdParam === 'string' ? Number(tableIdParam) : NaN;
    if (!isPositiveId(tableId)) {
      return { error: '올바른 테이블 번호를 입력하세요.' };
    }
    filters.tableId = tableId;
  }

  return { filters };
}

// GET /api/admin/orders?date=YYYY-MM-DD&status=접수&table_id=1 — all orders (including ended sessions),
// newest first. Bare array.
export async function getAdminOrders(req, res) {
  const { filters, error } = parseOrderFilters(req.query);
  if (error) {
    res.status(400).json({ message: error });
    return;
  }

  res.json(await findOrders(filters));
}

// GET /api/admin/orders/:orderId
export async function getAdminOrderById(req, res) {
  const orderId = Number(req.params.orderId);
  if (!isPositiveId(orderId)) {
    res.status(400).json({ message: '올바른 주문 번호를 입력하세요.' });
    return;
  }

  const order = await findOrderById(orderId);
  if (!order) {
    res.status(404).json({ message: '존재하지 않는 주문입니다.' });
    return;
  }

  res.json(order);
}

// PATCH /api/admin/orders/:orderId/status — body { order_status }. Moves the order one step forward
// and responds with the full order (same shape as GET /api/admin/orders/:orderId).
export async function patchAdminOrderStatus(req, res) {
  const orderId = Number(req.params.orderId);
  if (!isPositiveId(orderId)) {
    res.status(400).json({ message: '올바른 주문 번호를 입력하세요.' });
    return;
  }

  // req.body is undefined when the request has no JSON body.
  const nextStatus = req.body?.order_status;
  if (typeof nextStatus !== 'string' || !ORDER_STATUSES.includes(nextStatus)) {
    res.status(400).json({ message: STATUS_ERROR_MESSAGE });
    return;
  }

  res.json(await updateOrderStatus(orderId, nextStatus));
}
