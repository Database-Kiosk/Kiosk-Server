import express from 'express';
import cors from 'cors';
import env from './config/env.js';
import healthRoutes from './routes/healthRoutes.js';

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

// Health checks (server / database)
app.use('/health', healthRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

export default app;
