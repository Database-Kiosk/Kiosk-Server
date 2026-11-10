import { findAdminById } from '../services/adminService.js';
import {
  AUTH_COOKIE_NAME,
  verifyToken,
  fingerprintMatches,
  clearAuthCookieOptions,
} from '../services/tokenService.js';

function rejectUnauthorized(res) {
  res.clearCookie(AUTH_COOKIE_NAME, clearAuthCookieOptions());
  res.status(401).json({ message: '로그인이 필요합니다.' });
}

// Protects admin APIs. On success, sets req.admin = { adminId }.
export default async function requireAdmin(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token) {
    res.status(401).json({ message: '로그인이 필요합니다.' });
    return;
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    rejectUnauthorized(res);
    return;
  }

  // Re-check the account so that renaming the ID or changing the password invalidates old tokens.
  const admin = await findAdminById(payload.sub);
  if (!admin || admin.admin_id !== payload.sub || !fingerprintMatches(admin.password_hash, payload.fp)) {
    rejectUnauthorized(res);
    return;
  }

  req.admin = { adminId: admin.admin_id };
  next();
}
