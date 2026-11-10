import mysql from 'mysql2/promise';
import env from './env.js';

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  connectionLimit: env.db.connectionLimit,
  waitForConnections: true,
  queueLimit: 0,
  charset: 'utf8mb4',
  // DATETIME columns are returned as 'YYYY-MM-DD HH:mm:ss' strings,
  // avoiding implicit timezone conversion on the Node side.
  dateStrings: true,
});

// Maps common mysql2 / network error codes to a hint about what to check.
const DB_ERROR_HINTS = {
  ECONNREFUSED: 'MySQL 서버에 연결할 수 없습니다. MySQL 서비스가 실행 중인지, DB_HOST/DB_PORT가 올바른지 확인하세요.',
  ENOTFOUND: 'DB_HOST 주소를 찾을 수 없습니다. 호스트 이름을 확인하세요.',
  ETIMEDOUT: 'MySQL 서버 연결 시간이 초과되었습니다. 네트워크와 방화벽, DB_HOST/DB_PORT를 확인하세요.',
  ER_ACCESS_DENIED_ERROR: 'MySQL 인증에 실패했습니다. DB_USER/DB_PASSWORD를 확인하세요.',
  ER_BAD_DB_ERROR: '데이터베이스가 존재하지 않습니다. DB_NAME을 확인하고 스키마가 생성되었는지 확인하세요.',
  ER_DBACCESS_DENIED_ERROR: '해당 사용자에게 데이터베이스 접근 권한이 없습니다. DB_USER 권한을 확인하세요.',
  PROTOCOL_CONNECTION_LOST: 'MySQL 서버와의 연결이 끊어졌습니다.',
};

export function describeDbError(err) {
  const code = err.code || 'UNKNOWN';
  const hint = DB_ERROR_HINTS[code] || 'MySQL 연결 중 알 수 없는 오류가 발생했습니다.';
  // Connection errors (e.g. IPv4 + IPv6 attempts) may arrive as an AggregateError with an empty message.
  const detail = err.message || err.errors?.map((e) => e.message).join(' / ') || String(err);
  return { code, hint, detail };
}

export async function checkConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

export default pool;
