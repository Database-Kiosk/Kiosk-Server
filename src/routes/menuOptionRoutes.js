import { Router } from 'express';
import { getMenuOptions } from '../controllers/menuOptionController.js';

const router = Router();

router.get('/:menuId/options', getMenuOptions);

export default router;