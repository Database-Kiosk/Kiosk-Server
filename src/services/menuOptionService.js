import pool from '../config/db.js';

export async function findMenuOptions(menuId) {
  const [menus] = await pool.execute(
    'SELECT menu_id FROM menu WHERE menu_id = ?',
    [menuId],
  );

  if (menus.length === 0) {
    return null;
  }

  const [options] = await pool.execute(
    `SELECT option_id, option_name, additional_price
     FROM menu_option
     WHERE menu_id = ?
     ORDER BY option_id ASC`,
    [menuId],
  );

  return options;
}