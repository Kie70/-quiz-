export const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
export const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
export const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

const DAY_ORDER = { 周一: 1, 周二: 2, 周三: 3, 周四: 4, 周五: 5, 周六: 6, 周日: 7 };

export function sortCoursesByTime(courses) {
  return [...courses].sort((a, b) => {
    const dayDiff = (DAY_ORDER[a.day] ?? 0) - (DAY_ORDER[b.day] ?? 0);
    if (dayDiff !== 0) return dayDiff;
    const [aH, aM] = (a.start_time || `${a.startH ?? '08'}:${a.startM ?? '00'}`).split(':').map(Number);
    const [bH, bM] = (b.start_time || `${b.startH ?? '08'}:${b.startM ?? '00'}`).split(':').map(Number);
    const aMinutes = (Number.isNaN(aH) ? 0 : aH) * 60 + (Number.isNaN(aM) ? 0 : aM);
    const bMinutes = (Number.isNaN(bH) ? 0 : bH) * 60 + (Number.isNaN(bM) ? 0 : bM);
    return aMinutes - bMinutes;
  });
}

const pad2 = (n) => String(n ?? 0).padStart(2, '0');

export function courseToDisplay(c) {
  const start = c.start_time || `${c.startH ?? '08'}:${c.startM ?? '00'}`;
  const end = c.end_time || `${c.endH ?? '09'}:${c.endM ?? '00'}`;
  const [startH, startM] = start.split(':');
  const [endH, endM] = end.split(':');
  return {
    id: c.id,
    name: c.name,
    day: DAYS.includes(c.day) ? c.day : DAYS[0],
    start_time: `${pad2(startH)}:${pad2(startM)}`,
    end_time: `${pad2(endH)}:${pad2(endM)}`,
    startH: pad2(startH || '08'),
    startM: pad2(startM || '00'),
    endH: pad2(endH || '09'),
    endM: pad2(endM || '00'),
    quiz_reminder: Boolean(c.quiz_reminder),
    reminded_this_week: Boolean(c.reminded_this_week),
  };
}
