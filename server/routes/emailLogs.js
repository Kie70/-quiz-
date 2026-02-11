import { Router } from 'express';
import db from '../database/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendTestEmail } from '../services/scheduler.js';

const router = Router();
router.use(authMiddleware);

function insertEmailLog(userId, courseName, courseId = null) {
  db.prepare(
    'INSERT INTO email_logs (user_id, course_name, course_id, status) VALUES (?, ?, ?, ?)'
  ).run(userId, courseName, courseId, 'sent');
}

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

const TEST_EMAIL_COOLDOWN_MS = 30 * 60 * 1000; // 30 分钟

// POST /send-test-email - 向当前用户邮箱发送一封测试邮件，并写入邮件记录；每 30 分钟仅可发送一封
router.post('/send-test-email', async (req, res) => {
  try {
    const email = req.user?.email;
    if (!email) return res.status(401).json({ error: '未登录' });

    const last = db.prepare(
      "SELECT sent_at FROM email_logs WHERE user_id = ? AND course_name = '测试邮件' ORDER BY sent_at DESC LIMIT 1"
    ).get(req.user.userId);
    if (last?.sent_at) {
      const lastSent = new Date(last.sent_at).getTime();
      const now = Date.now();
      const remaining = Math.ceil((lastSent + TEST_EMAIL_COOLDOWN_MS - now) / 60000);
      if (remaining > 0) {
        return res.status(429).json({
          error: `测试邮件每 30 分钟仅可发送一封，请 ${remaining} 分钟后再试`,
        });
      }
    }

    await sendTestEmail(email);
    insertEmailLog(req.user.userId, '测试邮件', null);
    res.json({ success: true, message: '测试邮件已发送，请查收' });
  } catch (e) {
    res.status(500).json({ error: e.message || '发送失败' });
  }
});

export default router;
