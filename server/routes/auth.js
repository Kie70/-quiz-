import { Router } from 'express';
import jwt from 'jsonwebtoken';
import db from '../database/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { isAdmin } from '../middleware/admin.js';
import { JWT_SECRET } from '../lib/config.js';

const router = Router();

// 是否启用邮箱验证码登录。设为 'true' 时需先发送验证码再登录；否则仅凭邮箱即可登录（便于内测/演示）。
// 未来正式启用验证码时：在 server/.env 中设置 ENABLE_EMAIL_VERIFICATION=true，并确保前端启用验证码 UI（见 LoginView.jsx 中 VITE_ENABLE_EMAIL_VERIFICATION）。
const ENABLE_EMAIL_VERIFICATION = process.env.ENABLE_EMAIL_VERIFICATION === 'true';

// 仅允许 xjtlu.edu.cn 及其子域（如 student.xjtlu.edu.cn）邮箱登录
const EMAIL_REGEX = /^[^@\s]+@([a-z0-9-]+\.)*xjtlu\.edu\.cn$/i;

// 存储验证码（生产环境应使用 Redis 等，此处简化）。仅当 ENABLE_EMAIL_VERIFICATION 为 true 时使用。
// { code, expires, failCount, lockedUntil }
const codeStore = new Map();

// POST /send-code: 接收邮箱，生成 6 位随机数（仅校内邮箱），控制台打印，返回成功
// 未来启用验证码时保留；关闭验证码时前端不展示「获取验证码」按钮，一般不会请求此接口
router.post('/send-code', (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: '请提供邮箱' });
  }
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: '仅支持 xjtlu.edu.cn 邮箱' });
  }
  const key = email.toLowerCase();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const now = Date.now();
  const existing = codeStore.get(key) || {};
  codeStore.set(key, {
    code,
    expires: now + 5 * 60 * 1000,
    failCount: existing.failCount || 0,
    lockedUntil: existing.lockedUntil || 0,
  });
  console.log(`[Auth] 验证码已生成 (${email}): ${code}`);
  res.json({ success: true, message: '验证码已发送' });
});

// POST /login: 接收邮箱（及可选验证码）。ENABLE_EMAIL_VERIFICATION 为 true 时校验验证码；否则仅校验邮箱即可登录
router.post('/login', (req, res) => {
  const { email, code } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: '请提供邮箱' });
  }
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: '仅支持 xjtlu.edu.cn 邮箱' });
  }
  const key = email.toLowerCase();

  // ---------- 未来启用验证码：保留以下整段校验逻辑，并确保 ENABLE_EMAIL_VERIFICATION === 'true' ----------
  if (ENABLE_EMAIL_VERIFICATION) {
    if (!code || !String(code).trim()) {
      return res.status(400).json({ error: '请提供验证码' });
    }
    const stored = codeStore.get(key);
    const now = Date.now();

    if (!stored || stored.expires <= now) {
      codeStore.delete(key);
      return res.status(401).json({ error: '验证码错误或已过期' });
    }

    if (stored.lockedUntil && stored.lockedUntil > now) {
      return res.status(429).json({ error: '尝试次数过多，请 10 分钟后再试' });
    }

    if (stored.code !== String(code).trim()) {
      const failCount = (stored.failCount || 0) + 1;
      const lockedUntil = failCount >= 5 ? now + 10 * 60 * 1000 : stored.lockedUntil || 0;
      codeStore.set(key, { ...stored, failCount, lockedUntil });
      return res.status(401).json({ error: '验证码错误或已过期' });
    }

    codeStore.delete(key);
  }
  // ---------- 未启用验证码时跳过上面整段，仅凭邮箱登录 ----------

  let user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(key);
  if (!user) {
    const result = db.prepare('INSERT INTO users (email) VALUES (?)').run(key);
    user = { id: result.lastInsertRowid, email: key };
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, token });
});

// GET /me - 当前登录用户信息（含是否管理员）
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    email: req.user.email,
    isAdmin: isAdmin(req.user.email),
  });
});

export default router;
