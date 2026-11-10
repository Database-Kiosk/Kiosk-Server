import 'dotenv/config';

const required = ['DB_HOST', 'DB_USER', 'DB_NAME'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.warn(`[env] Missing environment variables: ${missing.join(', ')} (check .env)`);
}

const env = {
  port: Number(process.env.PORT) || 3000,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    tokenTtlSeconds: 8 * 60 * 60, // 8 hours
    // Enable in production (HTTPS). Local http development needs false.
    cookieSecure: process.env.COOKIE_SECURE === 'true',
  },
};

const MIN_JWT_SECRET_LENGTH = 32;

// Returns an error message if auth settings are invalid, otherwise null.
// Never includes the secret value itself.
export function validateAuthConfig() {
  const secret = env.auth.jwtSecret;
  if (!secret) {
    return 'JWT_SECRET이 설정되지 않았습니다. .env에 JWT_SECRET을 추가하세요.';
  }
  if (secret.trim() !== secret || secret.length < MIN_JWT_SECRET_LENGTH) {
    return `JWT_SECRET이 유효하지 않습니다. 앞뒤 공백 없이 ${MIN_JWT_SECRET_LENGTH}자 이상이어야 합니다.`;
  }
  return null;
}

export default env;
