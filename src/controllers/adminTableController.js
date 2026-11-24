import { findTablesWithSessionSummary } from '../services/tableService.js';
import { completeTableSession } from '../services/tableSessionService.js';
import { isPositiveId } from '../utils/validators.js';

// 전체 테이블 조회
export async function getAdminTables(req, res) {
  res.json(await findTablesWithSessionSummary());
}

// 테이블 이용 종료
export async function completeAdminTable(req, res) {
  const tableId = Number(req.params.tableId);

  if (!isPositiveId(tableId)) {
    res.status(400).json({
      message: '올바른 테이블 번호를 입력하세요.',
    });
    return;
  }

  const result = await completeTableSession(tableId);

  res.status(200).json(result);
}