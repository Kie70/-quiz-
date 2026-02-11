/**
 * 上海时区（UTC+8）时间工具，与服务器本地时区无关
 */
export const DAY_ORDER = { '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '周日': 7 };
export const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 当前上海时间对应的 Date（需用 getUTCHours/getUTCMinutes/getUTCDay 读取） */
export function getShanghaiNow() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utc + 8 * 60_000 * 60);
}

/** 本周一与本周日的 YYYY-MM-DD（周日 24 点后视为新周） */
export function getShanghaiWeekBounds() {
  const d = getShanghaiNow();
  const dow = d.getUTCDay();
  const daysSinceMonday = (dow + 6) % 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - daysSinceMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
  };
}

/** 课程时间（本周内 day + start_time）是否已早于当前时刻（上海时区） */
export function isCourseTimeBeforeNow(day, startTime) {
  const d = getShanghaiNow();
  const today = DAY_NAMES[d.getUTCDay()];
  const [h, m] = String(startTime || '00:00').split(':').map(Number);
  const courseMinutesSinceMonday = ((DAY_ORDER[day] || 1) - 1) * 24 * 60 + (h || 0) * 60 + (m || 0);
  const nowMinutesSinceMonday =
    ((DAY_ORDER[today] || 1) - 1) * 24 * 60 + d.getUTCHours() * 60 + d.getUTCMinutes();
  return courseMinutesSinceMonday < nowMinutesSinceMonday;
}
