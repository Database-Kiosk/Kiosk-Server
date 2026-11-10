import { describeDbError } from '../config/db.js';
import { getDatabaseStatus } from '../services/healthService.js';

export function getServerHealth(req, res) {
  res.json({ status: 'ok' });
}

export async function getDatabaseHealth(req, res) {
  try {
    const db = await getDatabaseStatus();
    res.json({
      status: 'ok',
      database: 'connected',
      name: db.database,
      version: db.version,
      tableCount: db.tables.length,
    });
  } catch (err) {
    const { code, hint } = describeDbError(err);
    console.error(`[db] Health check failed: ${code} ${err.message}`);
    res.status(503).json({ status: 'error', database: 'disconnected', code, message: hint });
  }
}
