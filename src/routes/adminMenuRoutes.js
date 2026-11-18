import { Router } from 'express';
import requireAdmin from '../middlewares/requireAdmin.js';
import uploadMenuImage from '../middlewares/uploadMenuImage.js';
import {
  getAdminMenus,
  postAdminMenu,
  patchAdminMenu,
  patchAdminMenuStatus,
} from '../controllers/adminMenuController.js';

const router = Router();

router.use(requireAdmin);

router.get('/', getAdminMenus);

router.post(
  '/',
  uploadMenuImage,
  postAdminMenu,
);

router.patch('/:menuId/status', patchAdminMenuStatus);
router.patch('/:menuId', patchAdminMenu);

export default router;