import { Router } from 'express';
import db from '../database/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendTestEmail } from '../services/scheduler.js';

const router = Router();
router.use(authMiddleware);

// GET / - 当前用户的邮件发送记录，按 sent_at 倒序；支持 courseName, fromDate, toDate 查询
router.get('/', (req, res) => {
  try {
    const { courseName, fromDate, toDate } = req.query;
    let sql = 'SELECT id, course_name, sent_at, status FROM email_logs WHERE user_id = ?';
    const params = [req.user.userId];

    if (courseName && String(courseName).trim()) {
      sql += ' AND course_name LIKE ?';
      params.push(`%${String(courseName).trim()}%`);
    }
    if (fromDate && String(fromDate).trim()) {
      sql += ' AND date(sent_at) >= date(?)';
      params.push(String(fromDate).trim());
    }
    if (toDate && String(toDate).trim()) {
      sql += ' AND date(sent_at) <= date(?)';
      params.push(String(toDate).trim());
    }

    sql += ' ORDER BY sent_at DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map((r) => ({ id: r.id, course_name: r.course_name, sent_at: r.sent_at, status: r.status })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /send-test-email - 向当前用户邮箱发送一封测试邮件
router.post('/send-test-email', async (req, res) => {
  try {
    const email = req.user?.email;
    if (!email) return res.status(401).json({ error: '未登录' });
    await sendTestEmail(email);
    res.json({ success: true, message: '测试邮件已发送，请查收' });
  } catch (e) {
    res.status(500).json({ error: e.message || '发送失败' });
  }
});

export default router;
