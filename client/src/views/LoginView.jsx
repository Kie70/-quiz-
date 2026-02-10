import { useState, useEffect } from 'react';
import { Mail, KeyRound } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';

// 是否展示验证码登录 UI。设为 'true' 时显示「获取验证码」+ 验证码输入框；否则仅邮箱即可登录。
// 未来启用验证码：在 client/.env 中设置 VITE_ENABLE_EMAIL_VERIFICATION=true，重新 build；并确保后端 ENABLE_EMAIL_VERIFICATION=true。
const ENABLE_EMAIL_VERIFICATION = import.meta.env.VITE_ENABLE_EMAIL_VERIFICATION === 'true';

export default function LoginView({ onLogin }) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const reason = sessionStorage.getItem('logout_reason');
      if (reason === 'expired') {
        sessionStorage.removeItem('logout_reason');
        toast('登录已过期，请重新登录', 'info');
      }
    } catch (_) {}
  }, [toast]);

  const sendCode = async () => {
    if (!email.trim()) {
      setError('请输入邮箱');
      return;
    }
    setError('');
    setLoading('send');
    try {
      await api.post('/auth/send-code', { email: email.trim() });
      setLoading('');
      const isDev = import.meta.env.DEV;
      toast(isDev ? '验证码已发送，开发模式下请查看服务器日志' : '验证码已发送至您的邮箱', 'success');
    } catch (err) {
      setLoading('');
      const msg = err.response?.data?.error || err.message || '发送失败';
      setError(msg);
      toast(msg);
    }
  };

  const login = async () => {
    if (!email.trim()) {
      setError('请输入邮箱');
      return;
    }
    if (ENABLE_EMAIL_VERIFICATION && !code.trim()) {
      setError('请输入验证码');
      return;
    }
    setError('');
    setLoading('login');
    try {
      const payload = ENABLE_EMAIL_VERIFICATION
        ? { email: email.trim(), code: code.trim() }
        : { email: email.trim() };
      const { data } = await api.post('/auth/login', payload);
      setLoading('');
      onLogin(data.token);
    } catch (err) {
      setLoading('');
      const status = err.response?.status;
      const msg = status === 429
        ? (err.response?.data?.error || '尝试次数过多，请 10 分钟后再试')
        : (err.response?.data?.error || err.message || '登录失败');
      setError(msg);
      toast(msg);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 shadow-xl">
      <h1 className="text-xl font-bold text-white mb-6 text-center">XJTLU Quiz Helper</h1>
      <p className="text-zinc-400 text-sm text-center mb-2">
        {ENABLE_EMAIL_VERIFICATION ? '验证码登录' : '邮箱登录'}
      </p>
      <p className="text-zinc-500 text-xs text-center mb-6">仅支持 @xjtlu.edu.cn 邮箱</p>
      <div className="space-y-4">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱（@xjtlu.edu.cn）"
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:ring-2 focus:ring-zinc-600 focus:border-zinc-600 outline-none"
          />
        </div>
        {/* 未来启用验证码时保留：验证码输入框与「获取验证码」按钮 */}
        {ENABLE_EMAIL_VERIFICATION && (
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="验证码"
              maxLength={6}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:ring-2 focus:ring-zinc-600 focus:border-zinc-600 outline-none"
            />
          </div>
        )}
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <div className="flex gap-2">
          {ENABLE_EMAIL_VERIFICATION && (
            <button
              type="button"
              onClick={sendCode}
              disabled={loading !== ''}
              className="flex-1 py-3 rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors disabled:opacity-50"
            >
              {loading === 'send' ? '发送中...' : '获取验证码'}
            </button>
          )}
          <button
            type="button"
            onClick={login}
            disabled={loading !== ''}
            className={`${ENABLE_EMAIL_VERIFICATION ? 'flex-1' : 'w-full'} py-3 rounded-lg bg-white text-zinc-950 font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50`}
          >
            {loading === 'login' ? '登录中...' : '登录'}
          </button>
        </div>
      </div>
    </div>
  );
}
