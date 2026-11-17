import { Router } from 'express';
import requireAdmin from '../middlewares/requireAdmin.js';
import { getAdminTables } from '../controllers/adminTableController.js';
import { getTableOrders } from '../controllers/orderController.js';

const router = Router();

// Every route in this router is admin only.
router.use(requireAdmin);

router.get('/', getAdminTables);
// Same handler as the customer API GET /api/tables/:tableId/orders (same validation, 404, response),
// only behind admin authentication.
router.get('/:tableId/orders', getTableOrders);

export default router;
