import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 显式从 server/.env 加载，避免 PM2 启动时 cwd 为项目根导致读取不到
dotenv.config({ path: path.join(__dirname, '.env') });
console.log('[Config] SMTP_HOST=', process.env.SMTP_HOST || '(未设置，将使用 smtp.example.com)');

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
const server = app.listen(PORT, () => {
  console.log(isProd ? `Server running on port ${PORT}` : `Server running on http://localhost:${PORT}`);
  startScheduler();
});
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[EADDRINUSE] 端口 ${PORT} 已被占用。请执行：\n  netstat -ano | findstr :${PORT}\n  taskkill /PID <显示的PID> /F`);
  }
  throw err;
});
