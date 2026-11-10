import { Router } from 'express';
import { getServerHealth, getDatabaseHealth } from '../controllers/healthController.js';

const router = Router();

router.get('/', getServerHealth);
router.get('/db', getDatabaseHealth);

export default router;
