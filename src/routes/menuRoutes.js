import { Router } from 'express';
import { getMenus } from '../controllers/menuController.js';

const router = Router();

router.get('/', getMenus);

export default router;
