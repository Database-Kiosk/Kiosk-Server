import pool from '../config/db.js';

export async function findMenuOptions(menuId) {
  const [rows] = await pool.execute(
    `SELECT o.option_id, o.option_name, o.additional_price
     FROM menu m
     LEFT JOIN menu_option o ON o.menu_id = m.menu_id
     WHERE m.menu_id = ? AND m.is_active = 1
     ORDER BY o.option_id`,
    [menuId],
  );

  if (rows.length === 0) {
    return null;
  }

  return rows.filter((option) => option.option_id !== null);
}