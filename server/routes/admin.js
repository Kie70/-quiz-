import { Router } from 'express';
import db from '../database/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/admin.js';
import { sendBroadcastEmail } from '../services/scheduler.js';

const router = Router();
router.use(authMiddleware);
router.use(adminMiddleware);

// GET /api/admin/users - 注册用户列表：邮箱、注册时间、课程数
router.get('/users', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT u.id, u.email, u.created_at,
        (SELECT COUNT(*) FROM courses c WHERE c.user_id = u.id) AS course_count
      FROM users u
      ORDER BY u.created_at DESC
    `).all();
    res.json(rows.map((r) => ({
      id: r.id,
      email: r.email,
      created_at: r.created_at,
      course_count: r.course_count,
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/email-stats - 邮件发送统计：总览 + 按用户汇总
router.get('/email-stats', (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) AS cnt FROM email_logs').get();
    const byUser = db.prepare(`
      SELECT u.email, u.id,
        COUNT(e.id) AS email_count
      FROM users u
      LEFT JOIN email_logs e ON e.user_id = u.id
      GROUP BY u.id
      ORDER BY email_count DESC
    `).all();
    res.json({
      total_count: total.cnt,
      by_user: byUser.map((r) => ({ email: r.email, user_id: r.id, email_count: r.email_count })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/broadcast - 向所有注册用户发送群发邮件
router.post('/broadcast', async (req, res) => {
  try {
    const { subject, body } = req.body;
    if (!subject || !body || typeof subject !== 'string' || typeof body !== 'string') {
      return res.status(400).json({ error: '请提供 subject 和 body' });
    }
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();
    if (!trimmedSubject || !trimmedBody) {
      return res.status(400).json({ error: 'subject 和 body 不能为空' });
    }

    const users = db.prepare('SELECT id, email FROM users').all();
    if (users.length === 0) {
      return res.json({ success: true, sent: 0, message: '暂无注册用户' });
    }

    const results = await sendBroadcastEmail(
      users.map((u) => u.email),
      trimmedSubject,
      trimmedBody
    );

    const sentSet = new Set(results.sentEmails || []);
    for (const u of users) {
      if (sentSet.has(u.email.toLowerCase())) {
        db.prepare(
          'INSERT INTO email_logs (user_id, course_name, course_id, status) VALUES (?, ?, ?, ?)'
        ).run(u.id, `[群发] ${trimmedSubject.substring(0, 50)}`, null, 'sent');
      }
    }

    res.json({ success: true, sent: results.sent, failed: results.failed });
  } catch (e) {
    res.status(500).json({ error: e.message || '群发失败' });
  }
});

export default router;
