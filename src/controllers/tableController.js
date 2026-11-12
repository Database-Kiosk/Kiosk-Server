
import { findTableById } from '../services/tableService.js';

export async function getTableById(req, res) {
  const tableId = Number(req.params.tableId);

  if (!Number.isSafeInteger(tableId) || tableId <= 0) {
    res.status(400).json({ message: '올바른 테이블 번호를 입력하세요.' });
    return;
  }

  const table = await findTableById(tableId);

  if (!table) {
    res.status(404).json({ message: '존재하지 않는 테이블입니다.' });
    return;
  }

  res.json(table);
}
