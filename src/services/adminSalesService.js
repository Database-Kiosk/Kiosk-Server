import pool from '../config/db.js';

// 기간별 조회 일수 (오늘 포함). Controller의 period 검증에도 사용한다.
export const PERIOD_DAYS = new Map([
  ['today', 1],
  ['week', 7],
  ['month', 30],
]);

function shiftDate(date, days) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

// 조회 기간 [startDate, endDate)를 계산한다.
// month가 있으면 해당 월 1일부터 다음 달 1일 전까지, 없으면 DB의 오늘 날짜를 기준으로 period 일수만큼 조회한다.
async function getSalesPeriod({ period, month }) {
  if (month !== undefined) {
    const startDate = `${month}-01`;
    const nextMonth = new Date(`${startDate}T00:00:00Z`);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    return { startDate, endDate: nextMonth.toISOString().slice(0, 10) };
  }

  const [[{ today }]] = await pool.query('SELECT CURRENT_DATE() AS today');
  const days = PERIOD_DAYS.get(period ?? 'today');
  return {
    startDate: shiftDate(today, 1 - days),
    endDate: shiftDate(today, 1),
  };
}

// 매출 조회. period, month, status는 Controller에서 검증된 값이다.
export async function getSalesReport({ period, month, status }) {
  const { startDate, endDate } = await getSalesPeriod({ period, month });
  return findSalesReport({ startDate, endDate, status });
}

async function findSalesReport({ startDate, endDate, status }) {
  const conditions = ['o.order_time >= ?', 'o.order_time < ?'];
  const params = [startDate, endDate];

  if (status !== undefined) {
    conditions.push('o.order_status = ?');
    params.push(status);
  }

  const where = conditions.join(' AND ');
  const connection = await pool.getConnection();

  try {
    // 두 SELECT가 같은 시점의 주문을 읽도록 한다.
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.beginTransaction();

    const [dailyRows] = await connection.execute(
      `SELECT DATE(o.order_time) AS date,
              COUNT(*) AS order_count,
              SUM(o.total_price) AS total_sales
       FROM orders o
       WHERE ${where}
       GROUP BY DATE(o.order_time)
       ORDER BY date DESC`,
      params,
    );

    const [menuRows] = await connection.execute(
      `SELECT m.menu_id, m.menu_name, c.category_name,
              SUM(d.quantity) AS quantity,
              SUM(
                d.quantity * (
                  d.unit_price + COALESCE((
                    SELECT SUM(oo.extra_price)
                    FROM orderoption oo
                    WHERE oo.order_detail_id = d.order_detail_id
                  ), 0)
                )
              ) AS total_sales
       FROM orders o
       JOIN orderdetail d ON d.order_id = o.order_id
       JOIN menu m ON m.menu_id = d.menu_id
       JOIN category c ON c.category_id = m.category_id
       WHERE ${where}
       GROUP BY m.menu_id, m.menu_name, c.category_name
       ORDER BY total_sales DESC, m.menu_id ASC`,
      params,
    );

    await connection.commit();

    const daily = dailyRows.map((row) => ({
      date: row.date,
      order_count: Number(row.order_count),
      total_sales: Number(row.total_sales),
    }));

    const menus = menuRows.map((row) => ({
      menu_id: row.menu_id,
      menu_name: row.menu_name,
      category_name: row.category_name,
      quantity: Number(row.quantity),
      total_sales: Number(row.total_sales),
    }));

    const orderCount = daily.reduce((sum, row) => sum + row.order_count, 0);
    const totalSales = daily.reduce((sum, row) => sum + row.total_sales, 0);
    const quantity = menus.reduce((sum, row) => sum + row.quantity, 0);

    return {
      summary: {
        total_sales: totalSales,
        order_count: orderCount,
        average_order_price: orderCount ? Math.round(totalSales / orderCount) : 0,
        quantity,
      },
      daily,
      menus,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}