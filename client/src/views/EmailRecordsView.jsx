import { useState, useEffect, useMemo } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';

const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

/**
 * 将 email_logs 聚合为 年 > 月 > 每门课 + 次数 的结构
 * 只保留汇总信息，不展示具体每条记录
 */
function aggregateByYearMonth(logs) {
  const byYear = {};
  logs.forEach((log) => {
    const d = log.sent_at ? new Date(log.sent_at) : null;
    if (!d || isNaN(d.getTime())) return;
    const year = d.getFullYear();
    const month = d.getMonth();
    if (!byYear[year]) byYear[year] = {};
    if (!byYear[year][month]) byYear[year][month] = {};
    const name = log.course_name || '未知';
    byYear[year][month][name] = (byYear[year][month][name] || 0) + 1;
  });
  const result = [];
  Object.keys(byYear)
    .map(Number)
    .sort((a, b) => b - a)
    .forEach((year) => {
      const months = [];
      Object.keys(byYear[year])
        .map(Number)
        .sort((a, b) => b - a)
        .forEach((month) => {
          const items = Object.entries(byYear[year][month]).map(([name, count]) => ({ name, count }));
          items.sort((a, b) => b.count - a.count);
          const total = items.reduce((s, x) => s + x.count, 0);
          months.push({ month: MONTH_NAMES[month], monthIndex: month, items, total });
        });
      result.push({ year: `${year}年`, yearNum: year, months });
    });
  return result;
}

export default function EmailRecordsView() {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingTest, setSendingTest] = useState(false);

  const fetchLogs = () => {
    setLoading(true);
    api
      .get('/email-logs')
      .then(({ data }) => setLogs(data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const records = useMemo(() => aggregateByYearMonth(logs), [logs]);
  const totalCount = logs.length;

  const handleSendTestEmail = async () => {
    setSendingTest(true);
    try {
      await api.post('/email-logs/send-test-email');
      toast('测试邮件已发送，请查收', 'success');
      fetchLogs();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || '发送失败';
      const isCooldown = err.response?.status === 429;
      toast(msg, isCooldown ? 'info' : 'error', { duration: isCooldown ? 5000 : 4000 });
    } finally {
      setSendingTest(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ['课程名称', '发送时间', '状态'];
    const rows = logs.map((l) => [l.course_name, l.sent_at || '', l.status || '']);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `邮件记录_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800">
        <div className="text-sm text-zinc-400">
          共 <span className="text-zinc-200 font-medium">{totalCount}</span> 条发送记录
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={logs.length === 0}
            className="px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-600 text-zinc-200 text-sm hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            导出 CSV
          </button>
          <button
            type="button"
            onClick={handleSendTestEmail}
            disabled={sendingTest}
            className="px-4 py-2 rounded-lg border border-zinc-600 text-zinc-400 text-sm hover:bg-zinc-800 hover:text-zinc-300 transition-colors disabled:opacity-50"
          >
            {sendingTest ? '发送中...' : '发送测试邮件'}
          </button>
        </div>
      </div>

      {/* 年 > 月 > 课程汇总 */}
      <div className="space-y-8 pl-4">
        {loading ? (
          <div className="text-zinc-500 py-8">加载中...</div>
        ) : records.length === 0 ? (
          <div className="text-zinc-500 py-8 space-y-1">
            <p>暂无邮件发送记录</p>
            <p className="text-xs text-zinc-600">收到第一封提醒后，这里会显示发送记录</p>
          </div>
        ) : (
          records.map((yearGroup) => (
            <div key={yearGroup.yearNum}>
              <h3 className="text-xl font-bold text-zinc-100 mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-zinc-100 rounded-full" />
                {yearGroup.year}
              </h3>
              <div className="space-y-6 border-l-2 border-zinc-800 ml-[3px] pl-8 pb-4">
                {yearGroup.months.map((monthGroup) => (
                  <div key={monthGroup.monthIndex} className="relative">
                    <div className="absolute -left-[41px] top-1.5 w-4 h-4 rounded-full bg-zinc-950 border-2 border-zinc-600" />
                    <div className="flex items-baseline gap-3 mb-3">
                      <h4 className="text-zinc-300 font-semibold text-lg">{monthGroup.month}</h4>
                      <span className="text-xs text-zinc-500">共 {monthGroup.total} 条</span>
                    </div>
                    <div className="space-y-2">
                      {monthGroup.items.map((item, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 transition-all"
                        >
                          <span className="text-zinc-300 text-sm">{item.name}</span>
                          <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 font-mono tabular-nums">
                            {item.count} 条
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
