import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';

export const AUTH_COOKIE_NAME = 'kiosk_admin_token';
const JWT_ALGORITHM = 'HS256';

function getSecret() {
  if (!env.auth.jwtSecret) throw new Error('JWT_SECRET is not configured');
  return env.auth.jwtSecret;
}

// Short fingerprint of the current password hash.
// Changing the password changes the fingerprint, which invalidates previously issued tokens.
export function passwordFingerprint(passwordHash) {
  return crypto.createHmac('sha256', getSecret()).update(passwordHash).digest('base64url').slice(0, 22);
}

export function fingerprintMatches(passwordHash, fingerprint) {
  if (typeof fingerprint !== 'string') return false;
  const expected = Buffer.from(passwordFingerprint(passwordHash));
  const actual = Buffer.from(fingerprint);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function issueToken(admin) {
  return jwt.sign({ fp: passwordFingerprint(admin.password_hash) }, getSecret(), {
    algorithm: JWT_ALGORITHM,
    subject: admin.admin_id,
    expiresIn: env.auth.tokenTtlSeconds,
  });
}

// Throws if the token is invalid or expired.
export function verifyToken(token) {
  return jwt.verify(token, getSecret(), { algorithms: [JWT_ALGORITHM] });
}

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: env.auth.cookieSecure,
    sameSite: 'strict',
    path: '/api',
  };
}

export function authCookieOptions() {
  return { ...baseCookieOptions(), maxAge: env.auth.tokenTtlSeconds * 1000 };
}

export function clearAuthCookieOptions() {
  return baseCookieOptions();
}
