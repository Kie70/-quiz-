import schedule from 'node-schedule';
import db from '../database/db.js';
import nodemailer from 'nodemailer';
import { getShanghaiNow, DAY_ORDER, DAY_NAMES } from '../lib/time.js';

let _transporter = null;
function getTransporter() {
  if (!_transporter) {
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.example.com',
      port: smtpPort,
      secure: smtpPort === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return _transporter;
}

const REMINDER_BEFORE_MINUTES = 5;
const CATCHUP_WINDOW_MINUTES = 10;

function runReminderCheck() {
  try {
    const now = getShanghaiNow();
    const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const today = DAY_NAMES[now.getUTCDay()];
    const todayOrder = DAY_ORDER[today];

    const all = db.prepare('SELECT c.id, c.name, c.day, c.start_time, c.quiz_reminder, u.email, u.id AS user_id FROM courses c JOIN users u ON c.user_id = u.id WHERE c.quiz_reminder = 1').all();

    const cutoffDate = new Date(Date.now() - CATCHUP_WINDOW_MINUTES * 60 * 1000);
    const cutoff = cutoffDate.toISOString().slice(0, 19).replace('T', ' ');
    const sentRecently = db.prepare('SELECT course_id FROM email_logs WHERE course_id IS NOT NULL AND sent_at >= ?').all(cutoff);
    const sentCourseIds = new Set(sentRecently.map((r) => r.course_id).filter(Boolean));

    for (const row of all) {
      const courseDay = String(row.day).trim();
      const rowDayOrder = DAY_ORDER[courseDay];
      if (todayOrder !== rowDayOrder) continue;

      const [h, m] = row.start_time.split(':').map(Number);
      const startMinutes = h * 60 + m;
      const reminderAt = startMinutes - REMINDER_BEFORE_MINUTES;
      const diff = nowMinutes - reminderAt;
      const inWindow = diff >= 0 && diff <= CATCHUP_WINDOW_MINUTES;
      const notSent = !sentCourseIds.has(row.id);

      if (inWindow && notSent) {
        console.log(`[Scheduler] Sending ${row.name} (Diff=${diff})`);
        const displayName = (row.name && String(row.name).trim()) ? row.name : 'Unnamed Course';
        const mailOptions = {
          from: process.env.SMTP_FROM || 'quiz@xjtlu.local',
          to: row.email,
          subject: `Quiz Reminder: ${displayName}`,
          text: `Your course ${displayName} will start in 5 minutes. Please prepare for the Quiz.\n\n(Automated message)`,
        };
        getTransporter().sendMail(mailOptions).then(() => {
          console.log(`Email Sent to [${row.email}]`);
          db.prepare('INSERT INTO email_logs (user_id, course_name, course_id, status) VALUES (?, ?, ?, ?)').run(row.user_id, `${displayName} Reminder`, row.id, 'sent');
        }).catch((err) => console.error(`Failed ${row.email}: ${err.message}`));
        sentCourseIds.add(row.id);
      }
    }
  } catch (e) { console.error('[Scheduler] Error:', e); }
}

export function startScheduler() {
  runReminderCheck();
  schedule.scheduleJob('* * * * *', runReminderCheck);
  console.log('[Scheduler] Started (Every 1 min)');
}

export function sendTestEmail(to) {
  return getTransporter().sendMail({
    from: process.env.SMTP_FROM || 'quiz@xjtlu.local',
    to,
    subject: 'XJTLU Quiz Helper Test Email',
    text: 'This is a test email. If you received this, the configuration is correct.',
  });
}

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
      console.error(`[Broadcast] Failed ${to}: ${err.message}`);
    }
  }
  return { sent: sentEmails.length, failed, sentEmails };
}