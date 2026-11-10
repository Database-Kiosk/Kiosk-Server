import { verifyCredentials } from '../services/adminService.js';
import {
  AUTH_COOKIE_NAME,
  issueToken,
  authCookieOptions,
  clearAuthCookieOptions,
} from '../services/tokenService.js';

const INVALID_CREDENTIALS_MESSAGE = '아이디 또는 비밀번호가 올바르지 않습니다.';

export async function login(req, res) {
  const { adminId, password } = req.body ?? {};

  if (typeof adminId !== 'string' || typeof password !== 'string' || !adminId || !password) {
    res.status(400).json({ message: '아이디와 비밀번호를 입력하세요.' });
    return;
  }

  const admin = await verifyCredentials(adminId, password);
  if (!admin) {
    res.status(401).json({ message: INVALID_CREDENTIALS_MESSAGE });
    return;
  }

  res.cookie(AUTH_COOKIE_NAME, issueToken(admin), authCookieOptions());
  res.json({ adminId: admin.admin_id });
}

// Clears the cookie only. An already-issued JWT stays valid until it expires (max 8 hours).
export function logout(req, res) {
  res.clearCookie(AUTH_COOKIE_NAME, clearAuthCookieOptions());
  res.status(204).end();
}

export function getMe(req, res) {
  res.json({ adminId: req.admin.adminId });
}
