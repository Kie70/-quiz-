import { useState, useEffect } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { Users, Mail, Send } from 'lucide-react';

export default function AdminView() {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [sending, setSending] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/email-stats'),
      ]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
    } catch (err) {
      if (err.response?.status === 403) {
        toast('无权限访问管理后台', 'error');
      } else {
        toast(err.response?.data?.error || '加载失败', 'error');
      }
      setUsers([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastSubject.trim() || !broadcastBody.trim()) {
      toast('请填写主题和正文', 'error');
      return;
    }
    setSending(true);
    try {
      const { data } = await api.post('/admin/broadcast', {
        subject: broadcastSubject.trim(),
        body: broadcastBody.trim(),
      });
      toast(`已发送 ${data.sent} 封，失败 ${data.failed} 封`, 'success');
      setBroadcastSubject('');
      setBroadcastBody('');
      fetchData();
    } catch (err) {
      toast(err.response?.data?.error || '发送失败', 'error');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (str) => {
    if (!str) return '-';
    const d = new Date(str);
    return isNaN(d.getTime()) ? str : d.toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' });
  };

  if (loading) {
    return (
      <div className="py-12 text-zinc-500 text-center">加载中...</div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
        <Users className="w-5 h-5" />
        管理后台
      </h2>

      {/* 概览 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="text-zinc-500 text-sm mb-1">注册用户数</div>
          <div className="text-2xl font-bold text-zinc-100">{users.length}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="text-zinc-500 text-sm mb-1">邮件发送总数</div>
          <div className="text-2xl font-bold text-zinc-100">{stats?.total_count ?? 0}</div>
        </div>
      </div>

      {/* 用户列表 */}
      <section>
        <h3 className="text-zinc-300 font-semibold mb-4 flex items-center gap-2">
          <Mail className="w-4 h-4" />
          注册用户
        </h3>
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-900/80 text-zinc-400 text-left">
                  <th className="px-4 py-3 font-medium">邮箱</th>
                  <th className="px-4 py-3 font-medium">注册时间</th>
                  <th className="px-4 py-3 font-medium">课程数</th>
                  <th className="px-4 py-3 font-medium">发送邮件数</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const userStats = stats?.by_user?.find((s) => s.email === u.email);
                  return (
                    <tr key={u.id} className="border-t border-zinc-800 hover:bg-zinc-900/30">
                      <td className="px-4 py-3 text-zinc-200">{u.email}</td>
                      <td className="px-4 py-3 text-zinc-400">{formatDate(u.created_at)}</td>
                      <td className="px-4 py-3 text-zinc-400">{u.course_count ?? 0}</td>
                      <td className="px-4 py-3 text-zinc-400">{userStats?.email_count ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {users.length === 0 && (
            <div className="px-4 py-8 text-zinc-500 text-center">暂无注册用户</div>
          )}
        </div>
      </section>

      {/* 群发邮件 */}
      <section>
        <h3 className="text-zinc-300 font-semibold mb-4 flex items-center gap-2">
          <Send className="w-4 h-4" />
          群发通知
        </h3>
        <form onSubmit={handleBroadcast} className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <p className="text-zinc-500 text-sm">
            向所有 {users.length} 位注册用户发送邮件
          </p>
          <div>
            <label className="block text-zinc-400 text-sm mb-1">主题</label>
            <input
              type="text"
              value={broadcastSubject}
              onChange={(e) => setBroadcastSubject(e.target.value)}
              placeholder="例如：系统维护通知"
              className="w-full px-4 py-2 rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-600"
            />
          </div>
          <div>
            <label className="block text-zinc-400 text-sm mb-1">正文</label>
            <textarea
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              placeholder="输入邮件正文..."
              rows={5}
              className="w-full px-4 py-2 rounded-lg bg-zinc-950 border border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-600 resize-y"
            />
          </div>
          <button
            type="submit"
            disabled={sending || users.length === 0}
            className="px-4 py-2 rounded-lg bg-white text-zinc-950 font-medium text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? '发送中...' : '发送'}
          </button>
        </form>
      </section>
    </div>
  );
}
