import { Router } from 'express';
import requireAdmin from '../middlewares/requireAdmin.js';
import { login, logout, getMe } from '../controllers/adminAuthController.js';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', requireAdmin, getMe);

export default router;
