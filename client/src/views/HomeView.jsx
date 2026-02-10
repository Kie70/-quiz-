import { useState, useEffect, useCallback } from 'react';
import { Circle, CircleDot, Trash2, Plus, CloudUpload } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { DAYS, HOURS, MINUTES, sortCoursesByTime, courseToDisplay } from '../lib/utils';

export default function HomeView({ onUnsavedChange, onCoursesSaved }) {
  const { toast } = useToast();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dirtyIds, setDirtyIds] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    onUnsavedChange?.(dirtyIds.size);
  }, [dirtyIds.size, onUnsavedChange]);

  const fetchCourses = useCallback(async () => {
    try {
      const { data } = await api.get('/courses');
      const list = data.map(courseToDisplay);
      setCourses(sortCoursesByTime(list));
      setDirtyIds(new Set());
    } catch (err) {
      const msg = err.response?.data?.error || err.message || '获取课程失败';
      toast(msg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleSort = () => {
    setCourses(sortCoursesByTime(courses));
  };

  const markDirty = (id) => {
    setDirtyIds((prev) => new Set(prev).add(id));
  };

  const updateCourse = (id, field, value) => {
    const c = courses.find((x) => x.id === id);
    if (!c) return;
    const next = { ...c, [field]: value };

    const startTotal = parseInt(next.startH, 10) * 60 + parseInt(next.startM, 10);
    const endTotal = parseInt(next.endH, 10) * 60 + parseInt(next.endM, 10);

    if (field === 'startH' || field === 'startM') {
      if (startTotal >= endTotal) {
        let newEnd = startTotal + 1;
        if (newEnd >= 24 * 60) newEnd = 24 * 60 - 1;
        next.endH = String(Math.floor(newEnd / 60)).padStart(2, '0');
        next.endM = String(newEnd % 60).padStart(2, '0');
      }
    } else if (field === 'endH' || field === 'endM') {
      if (endTotal <= startTotal) {
        let newStart = endTotal - 120;
        if (newStart < 0) newStart = 0;
        next.startH = String(Math.floor(newStart / 60)).padStart(2, '0');
        next.startM = String(newStart % 60).padStart(2, '0');
      }
    }

    const start_time = `${next.startH}:${next.startM}`;
    const end_time = `${next.endH}:${next.endM}`;
    setCourses((prev) => prev.map((x) => (x.id === id ? { ...next, start_time, end_time } : x)));
    markDirty(id);
  };

  const toggleReminder = (id) => {
    const c = courses.find((x) => x.id === id);
    if (!c) return;
    setCourses((prev) => prev.map((x) => (x.id === id ? { ...x, quiz_reminder: !x.quiz_reminder } : x)));
    markDirty(id);
  };

  const handleConfirm = async () => {
    if (dirtyIds.size === 0) return;
    setSaving(true);
    const ids = Array.from(dirtyIds);
    const succeeded = [];
    const failed = [];
    for (const id of ids) {
      const c = courses.find((x) => x.id === id);
      if (!c) continue;
      const start_time = `${c.startH}:${c.startM}`;
      const end_time = `${c.endH}:${c.endM}`;
      try {
        await api.put(`/courses/${id}`, {
          name: c.name,
          day: c.day,
          start_time,
          end_time,
          quiz_reminder: c.quiz_reminder,
        });
        succeeded.push(c.name || '未命名');
      } catch (err) {
        failed.push({ name: c.name || '未命名', msg: err.response?.data?.error || err.message || '保存失败' });
      }
    }
    setDirtyIds(new Set());
    onUnsavedChange?.(0);
    if (failed.length === 0) {
      toast(succeeded.length === 1 ? '已保存，课程表已更新' : `全部保存成功（${succeeded.length} 门）`, 'success');
      onCoursesSaved?.();
    } else if (succeeded.length > 0) {
      toast(`${succeeded.length} 门已保存，${failed.length} 门保存失败：${failed.map((f) => f.name).join('、')}`, 'error', { duration: 8000 });
    } else {
      toast(failed[0]?.msg || '保存失败', 'error', { duration: 8000 });
    }
    setSaving(false);
  };

  const addCourse = async () => {
    try {
      const { data } = await api.post('/courses', {
        name: '',
        day: '周一',
        start_time: '08:00',
        end_time: '10:00',
        quiz_reminder: false,
      });
      setCourses((prev) => [...prev, courseToDisplay(data)]);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || '添加失败';
      toast(msg);
    }
  };

  const deleteCourse = async (id) => {
    try {
      await api.delete(`/courses/${id}`);
      setCourses((prev) => prev.filter((c) => c.id !== id));
      setDirtyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      const msg = err.response?.data?.error || err.message || '删除失败';
      toast(msg);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-400">
        加载中...
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* 上传区 - 弱化，突出手动录入 */}
      <section
        role="button"
        tabIndex={0}
        onClick={() => toast('AI 识别功能开发中，请手动录入', 'info')}
        onKeyDown={(e) => e.key === 'Enter' && toast('AI 识别功能开发中，请手动录入', 'info')}
        className="border border-dashed border-zinc-800 rounded-lg hover:border-zinc-700 transition-all cursor-pointer py-4 px-5 text-center group"
      >
        <div className="inline-flex items-center gap-2 text-zinc-500 group-hover:text-zinc-400">
          <CloudUpload className="w-5 h-5" />
          <span className="text-sm">上传图片识别（开发中）</span>
        </div>
      </section>

      {/* 排序按钮 + 列表 */}
      <section className="space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-zinc-400 text-sm">
          <div className="flex items-center gap-4">
            <span className="font-medium text-zinc-300">手动录入 / 识别结果</span>
            <span className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
              <CircleDot className="w-3 h-3 text-zinc-100" />
              <span>代表课程需要 Quiz 提醒</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const headers = ['课程名称', '星期', '开始', '结束', 'Quiz提醒'];
                const rows = courses.map((c) => [
                  c.name || '未命名',
                  c.day,
                  `${c.startH}:${c.startM}`,
                  `${c.endH}:${c.endM}`,
                  c.quiz_reminder ? '是' : '否',
                ]);
                const csv = [headers.join(','), ...rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
                const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `课表_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-3 py-1.5 text-xs font-medium text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg hover:text-white hover:border-zinc-600 transition-all"
            >
              导出课表
            </button>
            <button
              type="button"
              onClick={handleSort}
              className="px-3 py-1.5 text-xs font-medium text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg hover:text-white hover:border-zinc-600 transition-all"
            >
              按时间排序
            </button>
            <span>{courses.length} 节课</span>
          </div>
        </div>

        <div className="space-y-3">
          {courses.length === 0 && (
            <p className="text-sm text-zinc-500 py-4 text-center">添加第一门课</p>
          )}
          {courses.map((course, index) => (
            <div
              key={course.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/30 border border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-900 transition-all group"
            >
              <span className="flex-shrink-0 w-6 text-center text-xs text-zinc-500 font-mono">
                {index + 1}
              </span>
              <button
                type="button"
                onClick={() => toggleReminder(course.id)}
                className="flex-shrink-0 text-zinc-400 hover:text-white transition-colors focus:outline-none"
                title="点击切换 Quiz 提醒"
              >
                {course.quiz_reminder ? (
                  <CircleDot className="w-5 h-5 text-zinc-100" />
                ) : (
                  <Circle className="w-5 h-5 text-zinc-500 hover:text-zinc-300" />
                )}
              </button>
              <div className="flex-shrink-0 w-24">
                <select
                  value={course.day}
                  onChange={(e) => updateCourse(course.id, 'day', e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:ring-2 focus:ring-zinc-600 outline-none cursor-pointer hover:border-zinc-600 transition-colors appearance-none bg-no-repeat bg-[length:1rem] bg-[right_0.5rem_center]"
                  style={{
                    backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23a1a1aa' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
                  }}
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d} className="bg-zinc-950">
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-700 rounded-lg p-1.5 flex-shrink-0">
                <div className="flex items-center">
                  <select
                    value={course.startH}
                    onChange={(e) => updateCourse(course.id, 'startH', e.target.value)}
                    className="bg-transparent text-sm text-zinc-200 outline-none font-mono w-10 text-center cursor-pointer hover:text-white py-1 rounded hover:bg-zinc-800"
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h} className="bg-zinc-950">
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-zinc-600 font-bold px-0.5">:</span>
                  <select
                    value={course.startM}
                    onChange={(e) => updateCourse(course.id, 'startM', e.target.value)}
                    className="bg-transparent text-sm text-zinc-200 outline-none font-mono w-10 text-center cursor-pointer hover:text-white py-1 rounded hover:bg-zinc-800"
                  >
                    {MINUTES.map((m) => (
                      <option key={m} value={m} className="bg-zinc-950">
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-zinc-600 px-1">-</span>
                <div className="flex items-center">
                  <select
                    value={course.endH}
                    onChange={(e) => updateCourse(course.id, 'endH', e.target.value)}
                    className="bg-transparent text-sm text-zinc-200 outline-none font-mono w-10 text-center cursor-pointer hover:text-white py-1 rounded hover:bg-zinc-800"
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h} className="bg-zinc-950">
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-zinc-600 font-bold px-0.5">:</span>
                  <select
                    value={course.endM}
                    onChange={(e) => updateCourse(course.id, 'endM', e.target.value)}
                    className="bg-transparent text-sm text-zinc-200 outline-none font-mono w-10 text-center cursor-pointer hover:text-white py-1 rounded hover:bg-zinc-800"
                  >
                    {MINUTES.map((m) => (
                      <option key={m} value={m} className="bg-zinc-950">
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <input
                type="text"
                value={course.name}
                onChange={(e) => updateCourse(course.id, 'name', e.target.value)}
                placeholder="课程名称（建议填写）"
                className="flex-1 bg-transparent border-b border-transparent focus:border-zinc-500 px-2 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all hover:bg-zinc-800/30 rounded"
              />
              <button
                type="button"
                onClick={() => deleteCourse(course.id)}
                className="flex-shrink-0 p-2 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addCourse}
            className="w-full py-4 mt-4 rounded-xl border border-dashed border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30 flex items-center justify-center gap-2 transition-all text-sm group"
          >
            <div className="p-1 rounded bg-zinc-900 group-hover:bg-zinc-800 transition-colors">
              <Plus className="w-4 h-4" />
            </div>
            <span>添加新课程</span>
          </button>

          {dirtyIds.size > 0 && (
            <p className="mt-4 text-amber-400/90 text-sm text-center">
              您有 {dirtyIds.size} 处未保存修改，请点击下方「保存」按钮
            </p>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={dirtyIds.size === 0 || saving}
            className="w-full py-4 mt-4 rounded-xl bg-white text-zinc-950 font-medium hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
          >
            {saving ? '保存中...' : dirtyIds.size > 0 ? `保存（${dirtyIds.size}）` : '确定'}
          </button>
        </div>
      </section>
    </div>
  );
}
