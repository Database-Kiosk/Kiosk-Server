import { findActiveMenus } from '../services/menuService.js';

export async function getMenus(req, res) {
  const menus = await findActiveMenus();
  res.json(menus);
}
