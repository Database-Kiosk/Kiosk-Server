import { findActiveCategories } from '../services/categoryService.js';

export async function getCategories(req, res) {
  const categories = await findActiveCategories();
  res.json(categories);
}
