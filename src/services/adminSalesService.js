import pool from '../config/db.js';

export async function findSalesReport({ startDate, endDate, status }) {
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