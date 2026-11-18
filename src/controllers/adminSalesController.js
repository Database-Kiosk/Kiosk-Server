import pool from '../config/db.js';
import { ORDER_STATUSES } from '../services/orderService.js';
import { findSalesReport } from '../services/adminSalesService.js';

const PERIOD_DAYS = new Map([
  ['today', 1],
  ['week', 7],
  ['month', 30],
]);

const MONTH_PATTERN = /^(?:[1-9]\d{3})-(?:0[1-9]|1[0-2])$/;

function shiftDate(date, days) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export async function getAdminSales(req, res) {
  const { period, month, status } = req.query;

  if (
    (period !== undefined && !PERIOD_DAYS.has(period)) ||
    (month !== undefined &&
      (typeof month !== 'string' || !MONTH_PATTERN.test(month) || month === '9999-12')) ||
    (period !== undefined && month !== undefined)
  ) {
    return res.status(400).json({
      message: 'period(today, week, month) 또는 month(YYYY-MM) 중 하나를 입력하세요.',
    });
  }

  if (status !== undefined && !ORDER_STATUSES.includes(status)) {
    return res.status(400).json({
      message: `주문 상태는 ${ORDER_STATUSES.join(', ')} 중 하나로 입력하세요.`,
    });
  }

  let startDate;
  let endDate;

  if (month !== undefined) {
    startDate = `${month}-01`;
    const nextMonth = new Date(`${startDate}T00:00:00Z`);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    endDate = nextMonth.toISOString().slice(0, 10);
  } else {
    const [[{ today }]] = await pool.query('SELECT CURRENT_DATE() AS today');
    const days = PERIOD_DAYS.get(period ?? 'today');
    startDate = shiftDate(today, 1 - days);
    endDate = shiftDate(today, 1);
  }

  return res.json(await findSalesReport({ startDate, endDate, status }));
}