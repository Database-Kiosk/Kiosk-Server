
import { Router } from 'express';
import { getTableById } from '../controllers/tableController.js';

const router = Router();

router.get('/:tableId', getTableById);

export default router;
