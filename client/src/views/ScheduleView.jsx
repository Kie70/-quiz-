import { useState, useEffect, useMemo } from 'react';
import { HelpCircle, X } from 'lucide-react';
import api from '../api/client';

const SCHEDULE_INTRO_DISMISSED_KEY = 'schedule_intro_dismissed';
import { DAYS, courseToDisplay, sortCoursesByTime } from '../lib/utils';

const LABEL_COLUMN_WIDTH_PX = 48;
const MIN_CELL_WIDTH_PX = 64;
const EMPTY_CELL_MIN_HEIGHT_PX = 44;

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
  const [introVisible, setIntroVisible] = useState(() => !localStorage.getItem(SCHEDULE_INTRO_DISMISSED_KEY));

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
      if (!DAYS.includes(c.day)) return;
      const slot = getSlot(c);
      if (g[slot] && g[slot][c.day]) g[slot][c.day].push(c);
    });
    return g;
  }, [courses]);

  const dismissIntro = () => {
    setIntroVisible(false);
    localStorage.setItem(SCHEDULE_INTRO_DISMISSED_KEY, '1');
  };

  const minTableWidth = LABEL_COLUMN_WIDTH_PX + DAYS.length * Math.max(MIN_CELL_WIDTH_PX, 52);

  return (
    <div className="space-y-4">
      {introVisible && (
        <div className="rounded-xl border border-white/30 bg-black/50 p-3 sm:p-4 flex items-start gap-3 text-sm text-zinc-300">
          <HelpCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-white/70" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white mb-1">状态说明</p>
            <p className="text-xs leading-relaxed">
              <span className="text-artistic-red">!待提醒</span>：本周还未发送提醒；<span className="text-morandi-blue">√已提醒</span>：本周已发过邮件。
            </p>
          </div>
          <button type="button" onClick={dismissIntro} className="flex-shrink-0 p-2 -m-1 text-zinc-400 hover:text-white active:text-white rounded transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" title="关闭">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 移动端：按天拆分，每页一列 */}
      <div className="sm:hidden space-y-3">
        {DAYS.map((day) => {
          const amList = grid.上午[day] || [];
          const pmList = grid.下午[day] || [];
          return (
            <div
              key={day}
              className="rounded-xl border border-white/80 bg-black overflow-hidden"
            >
              <div className="px-3 py-2 border-b border-white/50 text-white font-medium text-sm bg-white/5">
                {day}
              </div>
              <div className="p-2 space-y-3">
                <div>
                  <div className="text-[10px] text-white/60 uppercase tracking-wider mb-1.5 px-1">上午</div>
                  {amList.length === 0 ? (
                    <div className="text-[11px] text-white/40 py-2 px-2">—</div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {amList.map((c) => (
                        <MobileCourseCard key={c.id} course={c} />
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[10px] text-white/60 uppercase tracking-wider mb-1.5 px-1">下午</div>
                  {pmList.length === 0 ? (
                    <div className="text-[11px] text-white/40 py-2 px-2">—</div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {pmList.map((c) => (
                        <MobileCourseCard key={c.id} course={c} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 桌面端：保持原有表格布局 */}
      <div className="hidden sm:block overflow-x-auto -mx-3 md:mx-0">
        <div className="border border-white bg-black min-w-0" style={{ minWidth: minTableWidth }}>
          <div
            className="grid w-full max-w-full"
            style={{
              gridTemplateColumns: `${LABEL_COLUMN_WIDTH_PX}px repeat(${DAYS.length}, minmax(${MIN_CELL_WIDTH_PX}px, 1fr))`,
              gridTemplateRows: 'auto auto auto',
            }}
          >
            <div className="border-r border-b border-white bg-black min-h-[40px]" />
            {DAYS.map((d) => (
              <div
                key={`h-${d}`}
                className="p-2 flex items-center justify-center text-sm text-white font-medium bg-black border-r border-b border-white last:border-r-0"
              >
                {d}
              </div>
            ))}

            <div className="flex items-center justify-center p-2 text-white text-sm border-r border-b border-white bg-black min-h-[40px]">
              上午
            </div>
            {DAYS.map((day, colIndex) => {
              const list = grid.上午[day] || [];
              const isLastCol = colIndex === DAYS.length - 1;
              return (
                <div
                  key={`上午-${day}`}
                  className={`p-1.5 border-r border-b border-white bg-black align-top ${isLastCol ? 'border-r-0' : ''}`}
                  style={{ minHeight: list.length === 0 ? EMPTY_CELL_MIN_HEIGHT_PX : undefined }}
                >
                  <CellContent list={list} />
                </div>
              );
            })}

            <div className="flex items-center justify-center p-2 text-white text-sm border-r border-white bg-black min-h-[40px]">
              下午
            </div>
            {DAYS.map((day, colIndex) => {
              const list = grid.下午[day] || [];
              const isLastCol = colIndex === DAYS.length - 1;
              return (
                <div
                  key={`下午-${day}`}
                  className={`p-1.5 border-r border-white bg-black align-top ${isLastCol ? 'border-r-0' : ''}`}
                  style={{ minHeight: list.length === 0 ? EMPTY_CELL_MIN_HEIGHT_PX : undefined }}
                >
                  <CellContent list={list} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileCourseCard({ course }) {
  const code = (course.name && course.name.trim()) ? course.name : '未命名';
  const startTime = course.start_time || `${course.startH}:${course.startM}`;
  const endTime = course.end_time || `${course.endH}:${course.endM}`;
  const state = getReminderState(course);
  return (
    <div className="rounded-lg border border-white/60 bg-black/50 p-2.5 text-left">
      <div className="font-medium text-white text-sm truncate">{code}</div>
      <div className="font-mono text-xs text-white/80 mt-0.5">
        {startTime} – {endTime}
      </div>
      {state === 'reminded' && <div className="text-[10px] text-morandi-blue mt-1">√已提醒</div>}
      {state === 'pending' && <div className="text-[10px] text-artistic-red mt-1">!待提醒</div>}
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
        const statusLine = {
          none: null,
          reminded: (
            <div className="flex items-center gap-1 text-[10px] text-morandi-blue">
              <span>√已提醒</span>
            </div>
          ),
          pending: (
            <div className="flex items-center gap-1 text-[10px] text-artistic-red">
              <span>!待提醒</span>
            </div>
          ),
        };
        return (
          <div
            key={c.id}
            className="border border-white bg-black text-white text-left flex flex-col gap-0.5 p-1.5 flex-shrink-0 min-w-0"
          >
            <div className="font-semibold text-white text-[11px] sm:text-xs truncate" title={code}>
              {code}
            </div>
            <div className="font-mono text-[10px] text-white/90">
              {startTime} – {endTime}
            </div>
            {statusLine[state]}
          </div>
        );
      })}
    </div>
  );
}
