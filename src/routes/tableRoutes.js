
import { Router } from 'express';
import { getTableById } from '../controllers/tableController.js';
import { getTableOrders } from '../controllers/orderController.js';

const router = Router();

router.get('/:tableId', getTableById);
router.get('/:tableId/orders', getTableOrders);

export default router;
