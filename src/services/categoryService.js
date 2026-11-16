import pool from '../config/db.js';

// Customer categories: only those with at least one menu on sale (is_active = 1).
export async function findActiveCategories() {
  const [rows] = await pool.execute(
    `SELECT c.category_id, c.category_name
     FROM category c
     WHERE EXISTS (
       SELECT 1 FROM menu m WHERE m.category_id = c.category_id AND m.is_active = 1
     )
     ORDER BY c.category_id`,
  );

  return rows;
}
