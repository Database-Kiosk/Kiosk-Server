import pool from '../config/db.js';

// Customer menus: only menus on sale (is_active = 1), each with its options.
// Options are loaded in one query (not per menu) and grouped by menu_id.
export async function findActiveMenus() {
  const [menus] = await pool.execute(
    `SELECT menu_id, menu_name, price, category_id, description, image_url, is_active
     FROM menu
     WHERE is_active = 1
     ORDER BY category_id, menu_id`,
  );

  const [options] = await pool.execute(
    `SELECT o.option_id, o.menu_id, o.option_name, o.additional_price
     FROM menu_option o
     JOIN menu m ON m.menu_id = o.menu_id
     WHERE m.is_active = 1
     ORDER BY o.option_id`,
  );

  const optionsByMenuId = new Map();
  for (const { menu_id: menuId, ...option } of options) {
    if (!optionsByMenuId.has(menuId)) optionsByMenuId.set(menuId, []);
    optionsByMenuId.get(menuId).push(option);
  }

  return menus.map((menu) => ({ ...menu, options: optionsByMenuId.get(menu.menu_id) ?? [] }));
}
