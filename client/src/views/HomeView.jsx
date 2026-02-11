import { useState, useEffect, useCallback } from 'react';
import { Circle, Trash2, Plus, CloudUpload } from 'lucide-react';

const FIRST_UNSAVED_HINT_KEY = 'home_first_unsaved_hint_seen';
const SKIP_DELETE_CONFIRM_KEY = 'home_skip_delete_confirm';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { DAYS, HOURS, MINUTES, sortCoursesByTime, courseToDisplay } from '../lib/utils';

export default function HomeView({ onUnsavedChange, onCoursesSaved }) {
  const { toast } = useToast();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dirtyIds, setDirtyIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleteConfirmDontShowAgain, setDeleteConfirmDontShowAgain] = useState(false);
  const [addingCourse, setAddingCourse] = useState(false);

  useEffect(() => {
    onUnsavedChange?.(dirtyIds.size);
  }, [dirtyIds.size, onUnsavedChange]);

  // 首次有未保存时弱提示
  useEffect(() => {
    if (dirtyIds.size > 0) {
      const seen = localStorage.getItem(FIRST_UNSAVED_HINT_KEY);
      if (!seen) {
        toast('记得点保存，修改才会生效哦', 'info', { duration: 5000 });
        localStorage.setItem(FIRST_UNSAVED_HINT_KEY, '1');
      }
    }
  }, [dirtyIds.size, toast]);

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

    const sh = parseInt(next.startH, 10);
    const sm = parseInt(next.startM, 10);
    const eh = parseInt(next.endH, 10);
    const em = parseInt(next.endM, 10);
    const startTotal = (Number.isNaN(sh) ? 0 : sh) * 60 + (Number.isNaN(sm) ? 0 : sm);
    const endTotal = (Number.isNaN(eh) ? 0 : eh) * 60 + (Number.isNaN(em) ? 0 : em);

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
      const start_time = `${String(c.startH ?? '08').padStart(2, '0')}:${String(c.startM ?? '00').padStart(2, '0')}`;
      const end_time = `${String(c.endH ?? '09').padStart(2, '0')}:${String(c.endM ?? '00').padStart(2, '0')}`;
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
    if (addingCourse) return;
    setAddingCourse(true);
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
    } finally {
      setAddingCourse(false);
    }
  };

  const requestDeleteCourse = (id) => {
    if (localStorage.getItem(SKIP_DELETE_CONFIRM_KEY) === '1') {
      confirmDeleteCourseById(id);
    } else {
      setDeleteConfirmId(id);
      setDeleteConfirmDontShowAgain(false);
    }
  };

  const confirmDeleteCourseById = async (id) => {
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

  const cancelDeleteCourse = () => {
    setDeleteConfirmId(null);
  };

  const confirmDeleteCourse = async () => {
    const id = deleteConfirmId;
    if (!id) return;
    if (deleteConfirmDontShowAgain) {
      localStorage.setItem(SKIP_DELETE_CONFIRM_KEY, '1');
    }
    setDeleteConfirmId(null);
    await confirmDeleteCourseById(id);
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
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title">
          <div className="rounded-xl border border-white bg-black shadow-xl max-w-sm w-full p-6">
            <p id="delete-confirm-title" className="text-white text-sm mb-4">确定要删除这门课吗？此操作不可撤销。</p>
            <label className="flex items-center gap-2 mb-6 text-white/80 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={deleteConfirmDontShowAgain}
                onChange={(e) => setDeleteConfirmDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border border-white/60 bg-black accent-white cursor-pointer"
              />
              <span>下次删除时不再显示此确认</span>
            </label>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={cancelDeleteCourse} className="px-4 py-2 rounded-lg border border-white text-white text-sm hover:bg-white/10 transition-colors">取消</button>
              <button type="button" onClick={confirmDeleteCourse} className="px-4 py-2 rounded-lg bg-white text-black font-medium text-sm hover:bg-white/90 transition-colors">删除</button>
            </div>
          </div>
        </div>
      )}
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
            <span className="flex items-center gap-1.5 text-xs text-white bg-black px-2.5 py-1.5 rounded border border-white">
              <span className="w-3.5 h-3.5 rounded-full bg-white flex-shrink-0" />
              <span>开启后该课程上课前 5 分钟会发邮件提醒</span>
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
            <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 p-6 space-y-4">
              <p className="text-sm text-zinc-500 text-center">添加第一门课</p>
              <div className="flex flex-col gap-3 text-xs text-zinc-400">
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-700 text-zinc-200 flex items-center justify-center font-medium">1</span>
                  <span>添加课程：点击下方「添加新课程」，填写时间与名称</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-700 text-zinc-200 flex items-center justify-center font-medium">2</span>
                  <span>开启提醒：点击课程前的 ● 图标，开启后上课前 5 分钟会发邮件</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-700 text-zinc-200 flex items-center justify-center font-medium">3</span>
                  <span>点保存：修改完成后务必点击「保存」按钮，否则不会生效</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-700 text-zinc-200 flex items-center justify-center font-medium">4</span>
                  <span>温馨提醒：网站每10分钟集体发送邮件，如果没有收到邮件，请检查是否被拦截</span>
                </div>
        
              </div>
            </div>
          )}
          {courses.map((course, index) => (
            <div
              key={course.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-black border border-white hover:border-white/80 transition-all group"
            >
              <span className="flex-shrink-0 w-6 text-center text-xs text-white/70 font-mono">
                {index + 1}
              </span>
              <button
                type="button"
                onClick={() => toggleReminder(course.id)}
                className="flex-shrink-0 p-1 -m-1 text-white/70 hover:text-white transition-colors focus:outline-none cursor-pointer flex items-center justify-center"
                title={course.quiz_reminder ? '点击关闭 Quiz 提醒' : '点击开启 Quiz 提醒'}
              >
                {course.quiz_reminder ? (
                  <span className="block w-5 h-5 rounded-full bg-white flex-shrink-0 pointer-events-none" />
                ) : (
                  <Circle className="block w-5 h-5 text-white/50 hover:text-white/80 pointer-events-none" strokeWidth={1.5} />
                )}
              </button>
              <div className="flex-shrink-0 w-24">
                <select
                  value={course.day}
                  onChange={(e) => updateCourse(course.id, 'day', e.target.value)}
                  className="w-full bg-black border border-white rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-white/50 outline-none cursor-pointer hover:border-white/80 transition-colors appearance-none bg-no-repeat bg-[length:1rem] bg-[right_0.5rem_center]"
                  style={{
                    backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
                  }}
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d} className="bg-black text-white">
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 bg-black border border-white rounded-lg p-1.5 flex-shrink-0">
                <div className="flex items-center">
                  <select
                    value={course.startH}
                    onChange={(e) => updateCourse(course.id, 'startH', e.target.value)}
                    className="bg-transparent text-sm text-white outline-none font-mono w-10 text-center cursor-pointer hover:text-white/90 py-1 rounded hover:bg-white/10"
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h} className="bg-black text-white">
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-white/60 font-bold px-0.5">:</span>
                  <select
                    value={course.startM}
                    onChange={(e) => updateCourse(course.id, 'startM', e.target.value)}
                    className="bg-transparent text-sm text-white outline-none font-mono w-10 text-center cursor-pointer hover:text-white/90 py-1 rounded hover:bg-white/10"
                  >
                    {MINUTES.map((m) => (
                      <option key={m} value={m} className="bg-black text-white">
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-white/60 px-1">-</span>
                <div className="flex items-center">
                  <select
                    value={course.endH}
                    onChange={(e) => updateCourse(course.id, 'endH', e.target.value)}
                    className="bg-transparent text-sm text-white outline-none font-mono w-10 text-center cursor-pointer hover:text-white/90 py-1 rounded hover:bg-white/10"
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h} className="bg-black text-white">
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-white/60 font-bold px-0.5">:</span>
                  <select
                    value={course.endM}
                    onChange={(e) => updateCourse(course.id, 'endM', e.target.value)}
                    className="bg-transparent text-sm text-white outline-none font-mono w-10 text-center cursor-pointer hover:text-white/90 py-1 rounded hover:bg-white/10"
                  >
                    {MINUTES.map((m) => (
                      <option key={m} value={m} className="bg-black text-white">
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
                className="flex-1 bg-transparent border-b border-transparent focus:border-white/50 px-2 py-2 text-sm text-white placeholder:text-white/40 outline-none transition-all hover:bg-white/5 rounded"
              />
              <button
                type="button"
                onClick={() => requestDeleteCourse(course.id)}
                className="flex-shrink-0 p-2 text-white/50 hover:text-artistic-red opacity-0 group-hover:opacity-100 transition-opacity"
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addCourse}
            disabled={addingCourse}
            className="w-full py-4 mt-4 rounded-xl border border-dashed border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30 flex items-center justify-center gap-2 transition-all text-sm group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="p-1 rounded bg-zinc-900 group-hover:bg-zinc-800 transition-colors">
              <Plus className="w-4 h-4" />
            </div>
            <span>{addingCourse ? '添加中...' : '添加新课程'}</span>
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
            {saving ? '保存中...' : dirtyIds.size > 0 ? `保存（${dirtyIds.size}）` : '保存'}
          </button>
        </div>
      </section>
    </div>
  );
}
