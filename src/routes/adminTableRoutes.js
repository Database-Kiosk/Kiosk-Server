import { Router } from 'express';
import requireAdmin from '../middlewares/requireAdmin.js';
import {
  getAdminTables,
  completeAdminTable,
} from '../controllers/adminTableController.js';
import { getTableOrders } from '../controllers/orderController.js';

const router = Router();

// 아래의 모든 API에 관리자 인증 적용
router.use(requireAdmin);

router.get('/', getAdminTables);
router.get('/:tableId/orders', getTableOrders);
router.patch('/:tableId/complete', completeAdminTable);

export default router;