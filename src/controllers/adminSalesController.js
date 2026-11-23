import { ORDER_STATUSES, ORDER_STATUS_ERROR_MESSAGE } from '../services/orderService.js';
import { PERIOD_DAYS, getSalesReport } from '../services/adminSalesService.js';

const MONTH_PATTERN = /^(?:[1-9]\d{3})-(?:0[1-9]|1[0-2])$/;

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
      message: ORDER_STATUS_ERROR_MESSAGE,
    });
  }

  return res.json(await getSalesReport({ period, month, status }));
}
