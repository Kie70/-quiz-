import schedule from 'node-schedule';
import db from '../database/db.js';
import nodemailer from 'nodemailer';

const smtpPort = Number(process.env.SMTP_PORT) || 587;
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: smtpPort,
  secure: smtpPort === 465,
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
});

function getShanghaiNow() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utc + 8 * 60_000 * 60);
}

function runReminderCheck() {
  const now = getShanghaiNow();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const today = dayNames[now.getDay()];

  const all = db.prepare(`
    SELECT c.id, c.name, c.day, c.start_time, c.quiz_reminder, u.email, u.id AS user_id
    FROM courses c
    JOIN users u ON c.user_id = u.id
    WHERE c.quiz_reminder = 1
  `).all();

  for (const row of all) {
    const [h, m] = row.start_time.split(':').map(Number);
    const startMinutes = h * 60 + m;
    const reminderAt = startMinutes - 5;
    const dayOrder = { '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 7 };
    const todayOrder = dayOrder[today];
    const rowDayOrder = dayOrder[row.day];
    const isSameDay = todayOrder === rowDayOrder;
    if (!isSameDay) continue;
    if (nowMinutes >= reminderAt && nowMinutes < reminderAt + 1) {
      const displayName = (row.name && String(row.name).trim()) ? row.name : '未命名课程';
      const mailOptions = {
        from: process.env.SMTP_FROM || 'quiz@xjtlu.local',
        to: row.email,
        subject: `Quiz 提醒: ${displayName}`,
        text: `您的课程 ${displayName} 将在约 5 分钟后开始，请准备 Quiz。`,
      };
      transporter.sendMail(mailOptions).catch(() => {});
      console.log(`Email Sent to [${row.email}] for [${displayName}]`);
      db.prepare('INSERT INTO email_logs (user_id, course_name, status) VALUES (?, ?, ?)').run(row.user_id, `${displayName} 提醒`, 'sent');
    }
  }
}

export function startScheduler() {
  schedule.scheduleJob('* * * * *', runReminderCheck);
  console.log('[Scheduler] 每分钟检查一次 Quiz 提醒');
}

export function sendTestEmail(to) {
  return transporter.sendMail({
    from: process.env.SMTP_FROM || 'quiz@xjtlu.local',
    to,
    subject: 'XJTLU Quiz Helper 测试邮件',
    text: '这是一封测试邮件。如果您收到此邮件，说明邮件配置正常。',
  });
}
