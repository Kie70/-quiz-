import { Router } from 'express';
import db from '../database/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { sendTestEmail } from '../services/scheduler.js';

const router = Router();
router.use(authMiddleware);

function insertEmailLog(userId, courseName, courseId = null, status = 'sent') {
  db.prepare('INSERT INTO email_logs (user_id, course_name, course_id, status) VALUES (?, ?, ?, ?)').run(userId, courseName, courseId, status);
}

router.get('/', (req, res) => {
  try {
    const { courseName, fromDate, toDate } = req.query;
    let sql = 'SELECT id, course_name, sent_at, status FROM email_logs WHERE user_id = ?';
    const params = [req.user.userId];
    if (courseName && String(courseName).trim()) { sql += ' AND course_name LIKE ?'; params.push('%' + String(courseName).trim() + '%'); }
    if (fromDate && String(fromDate).trim()) { sql += ' AND date(sent_at) >= date(?)'; params.push(String(fromDate).trim()); }
    if (toDate && String(toDate).trim()) { sql += ' AND date(sent_at) <= date(?)'; params.push(String(toDate).trim()); }
    sql += ' ORDER BY sent_at DESC';
    const rows = db.prepare(sql).all(...params);
    res.json(rows.map((r) => ({ id: r.id, course_name: r.course_name, sent_at: r.sent_at, status: r.status })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const TEST_EMAIL_COOLDOWN_MS = 30 * 60 * 1000;
const TEST_EMAIL_FAILED_COOLDOWN_MS = 10 * 1000;

router.post('/send-test-email', async (req, res) => {
  try {
    const email = req.user?.email;
    if (!email) return res.status(401).json({ error: 'Not logged in' });

    const last = db.prepare("SELECT sent_at, status FROM email_logs WHERE user_id = ? AND course_name = 'Test Email' ORDER BY sent_at DESC LIMIT 1").get(req.user.userId);

    if (last?.sent_at) {
      const cooldownMs = last.status === 'failed' ? TEST_EMAIL_FAILED_COOLDOWN_MS : TEST_EMAIL_COOLDOWN_MS;
      const utcStr = String(last.sent_at).replace(' ', 'T') + 'Z';
      const lastSent = new Date(utcStr).getTime();
      const now = Date.now();
      const remainingMs = lastSent + cooldownMs - now;
      console.log(`[TestEmail] Check: last=${last.sent_at}, rem=${remainingMs}`);
      if (remainingMs > 0) {
        const isFailedCooldown = last.status === 'failed';
        const msg = isFailedCooldown ? `Failed recently, wait 10s. Try again in ${Math.ceil(remainingMs / 1000)}s` : `Test email allowed once every 30m. Try again in ${Math.ceil(remainingMs / 60000)}m`;
        return res.status(429).json({ error: msg });
      }
    }

    insertEmailLog(req.user.userId, 'Test Email', null);
    try {
      await sendTestEmail(email);
      res.json({ success: true, message: 'Test email sent' });
    } catch (e) {
      db.prepare("UPDATE email_logs SET status = 'failed' WHERE id = (SELECT id FROM email_logs WHERE user_id = ? AND course_name = 'Test Email' ORDER BY sent_at DESC LIMIT 1)").run(req.user.userId);
      res.status(500).json({ error: e.message || 'Send failed' });
    }
  } catch (e) { res.status(500).json({ error: e.message || 'Send failed' }); }
});

export default router;