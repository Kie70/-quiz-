import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

const isProd = process.env.NODE_ENV === 'production';
if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-secret-key')) {
  console.warn('[Security] 生产环境请设置 JWT_SECRET，切勿使用默认值');
}
import cors from 'cors';
import authRoutes from './routes/auth.js';
import coursesRoutes from './routes/courses.js';
import emailLogsRoutes from './routes/emailLogs.js';
import adminRoutes from './routes/admin.js';
import { startScheduler } from './services/scheduler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const corsOrigin = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || (isProd ? true : 'http://localhost:3000');
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/email-logs', emailLogsRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true }));

// 生产环境：托管前端构建产物，同一域名访问
if (isProd) {
  const distPath = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(isProd ? `Server running on port ${PORT}` : `Server running on http://localhost:${PORT}`);
  startScheduler();
});
