import { Router } from 'express';
import db from '../database/db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// 上海时区本周一与本周日的 YYYY-MM-DD（用于「本周已提醒」判断，每周日 24 点后视为新的一周）
function getShanghaiWeekBounds() {
  const now = new Date();
  const shanghaiTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const dow = shanghaiTime.getUTCDay();
  const daysSinceMonday = (dow + 6) % 7;
  const monday = new Date(shanghaiTime);
  monday.setUTCDate(shanghaiTime.getUTCDate() - daysSinceMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
  };
}

function courseNameForLog(name) {
  return (name && String(name).trim()) ? `${String(name).trim()} 提醒` : '未命名课程 提醒';
}

// GET / - 获取当前用户所有课程，并附带 reminded_this_week（本周是否已发过提醒）
router.get('/', (req, res) => {
  try {
    const rows = db.prepare(
      'SELECT id, user_id, name, day, start_time, end_time, quiz_reminder FROM courses WHERE user_id = ? ORDER BY id'
    ).all(req.user.userId);
    const { weekStart, weekEnd } = getShanghaiWeekBounds();
    const logsThisWeek = db.prepare(
      'SELECT course_name FROM email_logs WHERE user_id = ? AND date(sent_at) >= ? AND date(sent_at) <= ?'
    ).all(req.user.userId, weekStart, weekEnd);
    const logNamesSet = new Set(logsThisWeek.map((r) => r.course_name));

    const courses = rows.map((r) => {
      const quiz_reminder = Boolean(r.quiz_reminder);
      const reminded_this_week = quiz_reminder && logNamesSet.has(courseNameForLog(r.name));
      return {
        id: r.id,
        user_id: r.user_id,
        name: r.name,
        day: r.day,
        start_time: r.start_time,
        end_time: r.end_time,
        quiz_reminder,
        reminded_this_week,
      };
    });
    res.json(courses);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function isValidTimeString(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h >= 0 && h < 24 && m >= 0 && m < 60;
}

function ensureStartBeforeEnd(start, end) {
  if (!isValidTimeString(start) || !isValidTimeString(end)) return false;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  return endMinutes > startMinutes;
}

// POST / - 添加课程（name 可为空，用户稍后填写）
router.post('/', (req, res) => {
  const { name, day, start_time, end_time, quiz_reminder } = req.body;
  if (day == null || day === '' || !start_time || !end_time) {
    return res.status(400).json({ error: '缺少 day / start_time / end_time' });
  }
  if (!ensureStartBeforeEnd(String(start_time), String(end_time))) {
    return res.status(400).json({ error: '结束时间必须晚于开始时间，且格式需为 HH:MM' });
  }
  try {
    const result = db.prepare(
      'INSERT INTO courses (user_id, name, day, start_time, end_time, quiz_reminder) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      req.user.userId,
      name != null ? String(name).trim() : '',
      String(day),
      String(start_time),
      String(end_time),
      quiz_reminder ? 1 : 0
    );
    const row = db.prepare('SELECT id, user_id, name, day, start_time, end_time, quiz_reminder FROM courses WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      day: row.day,
      start_time: row.start_time,
      end_time: row.end_time,
      quiz_reminder: Boolean(row.quiz_reminder),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /:id - 更新课程（含 toggle reminder）
router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: '无效的课程 id' });
  const { name, day, start_time, end_time, quiz_reminder } = req.body;
  const current = db
    .prepare('SELECT id, user_id, name, day, start_time, end_time, quiz_reminder FROM courses WHERE id = ? AND user_id = ?')
    .get(id, req.user.userId);
  if (!current) return res.status(404).json({ error: '课程不存在' });

  const nextStart = start_time !== undefined ? String(start_time) : current.start_time;
  const nextEnd = end_time !== undefined ? String(end_time) : current.end_time;
  if (!ensureStartBeforeEnd(nextStart, nextEnd)) {
    return res.status(400).json({ error: '结束时间必须晚于开始时间，且格式需为 HH:MM' });
  }

  const updates = [];
  const values = [];
  if (name !== undefined) {
    updates.push('name = ?');
    values.push(String(name).trim());
  }
  if (day !== undefined) {
    updates.push('day = ?');
    values.push(String(day));
  }
  if (start_time !== undefined) {
    updates.push('start_time = ?');
    values.push(nextStart);
  }
  if (end_time !== undefined) {
    updates.push('end_time = ?');
    values.push(nextEnd);
  }
  if (quiz_reminder !== undefined) {
    updates.push('quiz_reminder = ?');
    values.push(quiz_reminder ? 1 : 0);
  }
  if (updates.length === 0) {
    return res.json({ ...current, quiz_reminder: Boolean(current.quiz_reminder) });
  }
  values.push(id);
  db.prepare(`UPDATE courses SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = db
    .prepare('SELECT id, user_id, name, day, start_time, end_time, quiz_reminder FROM courses WHERE id = ?')
    .get(id);
  res.json({ ...updated, quiz_reminder: Boolean(updated.quiz_reminder) });
});

// DELETE /:id
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: '无效的课程 id' });
  const result = db.prepare('DELETE FROM courses WHERE id = ? AND user_id = ?').run(id, req.user.userId);
  if (result.changes === 0) return res.status(404).json({ error: '课程不存在' });
  res.json({ success: true });
});

export default router;
