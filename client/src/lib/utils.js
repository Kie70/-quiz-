import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
export const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
export const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

const DAY_ORDER = { 周一: 1, 周二: 2, 周三: 3, 周四: 4, 周五: 5, 周六: 6, 周日: 7 };

export function sortCoursesByTime(courses) {
  return [...courses].sort((a, b) => {
    const dayDiff = (DAY_ORDER[a.day] ?? 0) - (DAY_ORDER[b.day] ?? 0);
    if (dayDiff !== 0) return dayDiff;
    const [aH, aM] = (a.start_time || `${a.startH}:${a.startM}`).split(':').map(Number);
    const [bH, bM] = (b.start_time || `${b.startH}:${b.startM}`).split(':').map(Number);
    return (aH * 60 + aM) - (bH * 60 + bM);
  });
}

export function courseToDisplay(c) {
  const start = c.start_time || `${c.startH}:${c.startM}`;
  const end = c.end_time || `${c.endH}:${c.endM}`;
  const [startH, startM] = start.split(':');
  const [endH, endM] = end.split(':');
  return {
    id: c.id,
    name: c.name,
    day: c.day,
    start_time: start,
    end_time: end,
    startH: startH || '08',
    startM: startM || '00',
    endH: endH || '09',
    endM: endM || '00',
    quiz_reminder: Boolean(c.quiz_reminder),
    reminded_this_week: Boolean(c.reminded_this_week),
  };
}
