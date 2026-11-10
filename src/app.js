import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import env from './config/env.js';
import verifyOrigin from './middlewares/verifyOrigin.js';
import healthRoutes from './routes/healthRoutes.js';
import adminAuthRoutes from './routes/adminAuthRoutes.js';

const app = express();

app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Health checks (server / database)
app.use('/health', healthRoutes);

// API
app.use('/api', verifyOrigin);
app.use('/api/admin', adminAuthRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
    return;
  }
  // Client errors are not logged: the error object may contain the raw request body (e.g. passwords).
  const message = err.type === 'entity.parse.failed' ? '요청 본문 형식이 올바르지 않습니다.' : err.message;
  res.status(status).json({ message });
});

export default app;
