import { useState, useEffect, useMemo } from 'react';
import { Check } from 'lucide-react';
import api from '../api/client';
import { DAYS, courseToDisplay, sortCoursesByTime } from '../lib/utils';

const LABEL_COLUMN_WIDTH_PX = 56;
const MIN_CELL_WIDTH_PX = 80;
const EMPTY_CELL_MIN_HEIGHT_PX = 48;

// 12:00 前为上午，否则下午
function getSlot(course) {
  const start = course.start_time || `${course.startH}:${course.startM}`;
  const [h] = start.split(':').map(Number);
  return h < 12 ? '上午' : '下午';
}

// 三类状态：不提醒 / 已提醒 / 待提醒（每周一至周日为一周，周日 24 点后视为新周，已提醒重置为待提醒）
function getReminderState(c) {
  if (!c.quiz_reminder) return 'none';
  return c.reminded_this_week ? 'reminded' : 'pending';
}

export default function ScheduleView({ refreshKey = 0 }) {
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    api.get('/courses')
      .then(({ data }) => setCourses(sortCoursesByTime(data.map(courseToDisplay))))
      .catch(() => setCourses([]));
  }, [refreshKey]);

  const grid = useMemo(() => {
    const g = { 上午: {}, 下午: {} };
    DAYS.forEach((d) => {
      g.上午[d] = [];
      g.下午[d] = [];
    });
    courses.forEach((c) => {
      const slot = getSlot(c);
      if (g[slot] && g[slot][c.day]) g[slot][c.day].push(c);
    });
    return g;
  }, [courses]);

  return (
    <div className="border border-zinc-800 rounded-xl bg-zinc-900/20 w-full max-w-full">
      <div
        className="grid w-full max-w-full"
        style={{
          gridTemplateColumns: `${LABEL_COLUMN_WIDTH_PX}px repeat(${DAYS.length}, minmax(${MIN_CELL_WIDTH_PX}px, 1fr))`,
          gridTemplateRows: 'auto auto auto',
        }}
      >
        <div className="border-r border-b border-zinc-800 bg-zinc-900/80 min-h-[40px]" />
        {DAYS.map((d) => (
          <div
            key={`h-${d}`}
            className="p-2 flex items-center justify-center text-sm text-zinc-400 font-medium bg-zinc-900/80 border-r border-b border-zinc-800 last:border-r-0"
          >
            {d}
          </div>
        ))}

        <div className="flex items-center justify-center p-2 text-zinc-500 text-sm border-r border-b border-zinc-800 bg-zinc-900/60 min-h-[40px]">
          上午
        </div>
        {DAYS.map((day, colIndex) => {
          const list = grid.上午[day] || [];
          const isLastCol = colIndex === DAYS.length - 1;
          return (
            <div
              key={`上午-${day}`}
              className={`p-1.5 border-r border-b border-zinc-800 bg-zinc-900/20 align-top ${isLastCol ? 'border-r-0' : ''}`}
              style={{ minHeight: list.length === 0 ? EMPTY_CELL_MIN_HEIGHT_PX : undefined }}
            >
              <CellContent list={list} />
            </div>
          );
        })}

        <div className="flex items-center justify-center p-2 text-zinc-500 text-sm border-r border-zinc-800 bg-zinc-900/60 min-h-[40px]">
          下午
        </div>
        {DAYS.map((day, colIndex) => {
          const list = grid.下午[day] || [];
          const isLastCol = colIndex === DAYS.length - 1;
          return (
            <div
              key={`下午-${day}`}
              className={`p-1.5 border-r border-zinc-800 bg-zinc-900/20 align-top ${isLastCol ? 'border-r-0' : ''}`}
              style={{ minHeight: list.length === 0 ? EMPTY_CELL_MIN_HEIGHT_PX : undefined }}
            >
              <CellContent list={list} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CellContent({ list }) {
  if (!list || list.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1.5">
      {list.map((c) => {
        const code = (c.name && c.name.trim()) ? c.name : '未命名';
        const startTime = c.start_time || `${c.startH}:${c.startM}`;
        const endTime = c.end_time || `${c.endH}:${c.endM}`;
        const state = getReminderState(c);
        const cardStyles = {
          none: 'bg-zinc-800/40 border-zinc-700/80 text-zinc-500 border-l-2 border-l-zinc-600',
          reminded: 'bg-emerald-950/50 border-emerald-800/60 text-emerald-200/90 border-l-2 border-l-emerald-500',
          pending: 'bg-amber-950/40 border-amber-800/60 text-amber-200/90 border-l-2 border-l-amber-500',
        };
        const statusLine = {
          none: null,
          reminded: (
            <div className="flex items-center gap-1 text-[10px] text-emerald-400/90">
              <Check className="w-3 h-3 flex-shrink-0" />
              <span>已提醒</span>
            </div>
          ),
          pending: (
            <div className="flex items-center gap-1 text-[10px] text-amber-400">
              <Check className="w-3 h-3 flex-shrink-0" />
              <span>待提醒</span>
            </div>
          ),
        };
        return (
          <div
            key={c.id}
            className={`rounded border text-left flex flex-col gap-0.5 p-1.5 flex-shrink-0 ${cardStyles[state]}`}
          >
            <div className="font-semibold text-zinc-200 text-xs truncate" title={code}>
              {code}
            </div>
            <div className="font-mono text-[10px] opacity-90">
              {startTime} – {endTime}
            </div>
            {statusLine[state]}
          </div>
        );
      })}
    </div>
  );
}
