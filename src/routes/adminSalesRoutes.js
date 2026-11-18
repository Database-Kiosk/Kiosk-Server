import { Router } from 'express';
import requireAdmin from '../middlewares/requireAdmin.js';
import { getAdminSales } from '../controllers/adminSalesController.js';

const router = Router();

router.use(requireAdmin);
router.get('/', getAdminSales);

export default router;