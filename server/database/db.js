import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDataDir = path.join(__dirname, '..', 'data');
const dataDir = process.env.DATABASE_DIR || defaultDataDir;
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'quiz.db');

const db = new Database(dbPath);

// users: id, email (unique), token, created_at
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    token TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

// courses: id, user_id, name, day, start_time, end_time, quiz_reminder (0/1)
db.exec(`
  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    day TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    quiz_reminder INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// email_logs: id, user_id, course_name, sent_at, status
db.exec(`
  CREATE TABLE IF NOT EXISTS email_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    course_name TEXT NOT NULL,
    sent_at TEXT DEFAULT (datetime('now')),
    status TEXT DEFAULT 'sent',
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);
try {
  const info = db.prepare('PRAGMA table_info(email_logs)').all();
  if (!info.some((col) => col.name === 'user_id')) {
    db.exec('ALTER TABLE email_logs ADD COLUMN user_id INTEGER REFERENCES users(id)');
  }
} catch (_) {}

export default db;
