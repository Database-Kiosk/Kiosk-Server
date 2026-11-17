import { Router } from 'express';
import requireAdmin from '../middlewares/requireAdmin.js';
import { getAdminOrders, getAdminOrderById, patchAdminOrderStatus } from '../controllers/adminOrderController.js';

const router = Router();

// Every route in this router is admin only.
router.use(requireAdmin);

router.get('/', getAdminOrders);
router.get('/:orderId', getAdminOrderById);
router.patch('/:orderId/status', patchAdminOrderStatus);

export default router;
