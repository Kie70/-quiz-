import schedule from 'node-schedule';
import db from '../database/db.js';
import nodemailer from 'nodemailer';
import { getShanghaiNow, DAY_ORDER, DAY_NAMES } from '../lib/time.js';

// 延迟创建 transporter，确保 dotenv 已加载完成后再读取环境变量
let _transporter = null;
function getTransporter() {
  if (!_transporter) {
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    _transporter = nodemailer.createTransport({
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
  }
  return _transporter;
}

const REMINDER_BEFORE_MINUTES = 5;
const CATCHUP_WINDOW_MINUTES = 10;

function runReminderCheck() {
  const now = getShanghaiNow();
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const today = DAY_NAMES[now.getUTCDay()];
  const todayOrder = DAY_ORDER[today];

  const all = db.prepare(`
    SELECT c.id, c.name, c.day, c.start_time, c.quiz_reminder, u.email, u.id AS user_id
    FROM courses c
    JOIN users u ON c.user_id = u.id
    WHERE c.quiz_reminder = 1
  `).all();

  const cutoffDate = new Date(Date.now() - CATCHUP_WINDOW_MINUTES * 60 * 1000);
  const cutoff = cutoffDate.toISOString().slice(0, 19).replace('T', ' ');
  const sentRecently = db.prepare(
    'SELECT course_id FROM email_logs WHERE course_id IS NOT NULL AND sent_at >= ?'
  ).all(cutoff);
  const sentCourseIds = new Set(sentRecently.map((r) => r.course_id).filter(Boolean));

  for (const row of all) {
    const rowDayOrder = DAY_ORDER[row.day];
    if (todayOrder !== rowDayOrder) continue;

    const [h, m] = row.start_time.split(':').map(Number);
    const startMinutes = h * 60 + m;
    const reminderAt = startMinutes - REMINDER_BEFORE_MINUTES;

    const reminderTimeInWindow = reminderAt >= nowMinutes - CATCHUP_WINDOW_MINUTES && reminderAt <= nowMinutes;
    const notSentRecently = !sentCourseIds.has(row.id);

    if (reminderTimeInWindow && notSentRecently) {
      const displayName = (row.name && String(row.name).trim()) ? row.name : '未命名课程';
      const mailOptions = {
        from: process.env.SMTP_FROM || 'quiz@xjtlu.local',
        to: row.email,
        subject: `Quiz 提醒: ${displayName}`,
        text: `您的课程 ${displayName} 将在约 5 分钟后开始，请准备 Quiz。`,
      };
      getTransporter().sendMail(mailOptions)
        .then(() => {
          console.log(`Email Sent to [${row.email}] for [${displayName}]`);
          db.prepare('INSERT INTO email_logs (user_id, course_name, course_id, status) VALUES (?, ?, ?, ?)').run(row.user_id, `${displayName} 提醒`, row.id, 'sent');
        })
        .catch((err) => {
          console.error(`[Scheduler] 发送失败 [${row.email}]:`, err.message);
        });
      sentCourseIds.add(row.id);
    }
  }
}

export function startScheduler() {
  runReminderCheck();
  schedule.scheduleJob('0,10,20,30,40,50 * * * *', runReminderCheck);
  console.log('[Scheduler] 每 10 分钟检查一次 Quiz 提醒（分钟为 5 的倍数，如 11:50、12:00）');
}

export function sendTestEmail(to) {
  return getTransporter().sendMail({
    from: process.env.SMTP_FROM || 'quiz@xjtlu.local',
    to,
    subject: 'XJTLU Quiz Helper 测试邮件',
    text: '这是一封测试邮件。如果您收到此邮件，说明邮件配置正常。',
  });
}

/**
 * 群发邮件：向多个收件人发送相同内容的邮件
 * @param {string[]} toList - 收件人邮箱列表
 * @param {string} subject - 主题
 * @param {string} text - 正文
 * @returns {Promise<{ sent: number, failed: number, sentEmails: string[] }>}
 */
export async function sendBroadcastEmail(toList, subject, text) {
  const unique = [...new Set(toList.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
  const sentEmails = [];
  let failed = 0;
  const from = process.env.SMTP_FROM || 'quiz@xjtlu.local';
  for (const to of unique) {
    try {
      await getTransporter().sendMail({ from, to, subject, text });
      sentEmails.push(to);
    } catch (err) {
      failed++;
      console.error(`[Broadcast] 发送失败 [${to}]:`, err.message);
    }
  }
  return { sent: sentEmails.length, failed, sentEmails };
}
