import bcrypt from 'bcryptjs';
import pool from '../config/db.js';

const BCRYPT_COST = 12;
const ADMIN_ID_MAX_LENGTH = 50; // admin.admin_id varchar(50)
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72; // bcrypt ignores bytes beyond 72

// Used to keep response time similar when the admin ID does not exist.
let dummyHashPromise;
function getDummyHash() {
  dummyHashPromise ??= bcrypt.hash('dummy-password-for-timing-safety', BCRYPT_COST);
  return dummyHashPromise;
}

// Returns an error message if invalid, otherwise null.
export function validateAdminId(adminId) {
  if (typeof adminId !== 'string' || adminId.length === 0) return '아이디를 입력하세요.';
  if (adminId.length > ADMIN_ID_MAX_LENGTH) return `아이디는 ${ADMIN_ID_MAX_LENGTH}자 이하여야 합니다.`;
  if (/\s/.test(adminId)) return '아이디에 공백을 포함할 수 없습니다.';
  return null;
}

// Returns an error message if invalid, otherwise null.
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`;
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    return `비밀번호는 ${PASSWORD_MAX_BYTES}바이트 이하여야 합니다.`;
  }
  return null;
}

// Lookup follows the column collation (case-insensitive).
export async function findAdminById(adminId) {
  const [rows] = await pool.execute(
    'SELECT admin_id, password_hash FROM admin WHERE admin_id = ?',
    [adminId],
  );
  return rows[0] ?? null;
}

export async function countAdmins() {
  const [[row]] = await pool.query('SELECT COUNT(*) AS count FROM admin');
  return Number(row.count);
}

// Returns the admin row on success, otherwise null (same result for unknown ID or wrong password).
export async function verifyCredentials(adminId, password) {
  const admin = await findAdminById(adminId);
  const passwordTooLong = Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES;

  if (!admin || passwordTooLong) {
    await bcrypt.compare(password, await getDummyHash());
    return null;
  }

  const matches = await bcrypt.compare(password, admin.password_hash);
  return matches ? admin : null;
}

export async function createAdmin(adminId, password) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  await pool.execute('INSERT INTO admin (admin_id, password_hash) VALUES (?, ?)', [adminId, passwordHash]);
}

export async function changePassword(adminId, password) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const [result] = await pool.execute('UPDATE admin SET password_hash = ? WHERE admin_id = ?', [
    passwordHash,
    adminId,
  ]);
  return result.affectedRows === 1;
}

export async function renameAdmin(currentId, newId) {
  const [result] = await pool.execute('UPDATE admin SET admin_id = ? WHERE admin_id = ?', [newId, currentId]);
  return result.affectedRows === 1;
}
