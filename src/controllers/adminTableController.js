import { findTablesWithSessionSummary } from '../services/tableService.js';

// GET /api/admin/tables — every table with its open-session summary (session: null if none).
export async function getAdminTables(req, res) {
  res.json(await findTablesWithSessionSummary());
}
