import { useState, useEffect } from 'react';
import { CircleUserRound, Home, Calendar, Mail, Shield } from 'lucide-react';
import { ToastProvider } from './context/ToastContext';
import LoginView from './views/LoginView';
import HomeView from './views/HomeView';
import ScheduleView from './views/ScheduleView';
import EmailRecordsView from './views/EmailRecordsView';
import AdminView from './views/AdminView';
import api from './api/client';

const TOKEN_KEY = 'token';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [tab, setTab] = useState('home');
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [homeUnsavedCount, setHomeUnsavedCount] = useState(0);
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0);
  const [leaveConfirmTarget, setLeaveConfirmTarget] = useState(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }, [token]);

  useEffect(() => {
    if (token) {
      api.get('/auth/me').then(({ data }) => {
        setIsAdmin(data.isAdmin ?? false);
        setUserEmail(data.email ?? '');
      }).catch(() => {
        setIsAdmin(false);
        setUserEmail('');
      });
    } else {
      setIsAdmin(false);
      setUserEmail('');
    }
  }, [token]);

  if (!token) {
    return (
      <ToastProvider>
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
          <LoginView onLogin={(t) => setToken(t)} />
        </div>
      </ToastProvider>
    );
  }

  const handleTabChange = (to) => {
    if (to !== 'home' && homeUnsavedCount > 0) {
      setLeaveConfirmTarget(to);
      return;
    }
    setTab(to);
  };

  const confirmLeave = () => {
    if (leaveConfirmTarget) {
      setTab(leaveConfirmTarget);
      setLeaveConfirmTarget(null);
    }
  };

  const cancelLeave = () => {
    setLeaveConfirmTarget(null);
  };

  const handleLogoutClick = () => {
    setLogoutConfirmOpen(true);
  };

  const confirmLogout = () => {
    setToken(null);
    setLogoutConfirmOpen(false);
  };

  const cancelLogout = () => {
    setLogoutConfirmOpen(false);
  };

  const navItems = [
    { to: 'home', label: '主页', Icon: Home },
    { to: 'schedule', label: '课程表', Icon: Calendar },
    { to: 'email', label: '邮件记录', Icon: Mail },
    ...(isAdmin ? [{ to: 'admin', label: '管理', Icon: Shield }] : []),
  ];

  const NavLink = ({ to, label, Icon, variant = 'top' }) => {
    const isActive = tab === to;
    const base = variant === 'bottom'
      ? `flex flex-col items-center justify-center gap-0.5 py-2.5 min-w-0 flex-1 text-xs transition-colors touch-manipulation ${
          isActive ? 'text-white' : 'text-zinc-400 active:text-zinc-200'
        }`
      : `text-sm font-medium h-16 flex items-center gap-1.5 transition-colors relative px-2 ${
          isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
        }`;
    return (
      <button
        type="button"
        onClick={() => handleTabChange(to)}
        className={base}
      >
        {variant === 'bottom' && Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
        <span className={variant === 'bottom' ? 'truncate max-w-full' : ''}>{label}</span>
        {variant === 'top' && isActive && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-white" />}
      </button>
    );
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased pb-16 sm:pb-0">
        {leaveConfirmTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="leave-confirm-title">
            <div className="rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl max-w-sm w-full p-6 max-h-[90vh] overflow-y-auto">
              <p id="leave-confirm-title" className="text-zinc-200 text-sm mb-6">当前修改未保存，是否离开？</p>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={cancelLeave} className="px-4 py-2.5 rounded-lg border border-zinc-600 text-zinc-300 text-sm hover:bg-zinc-800 transition-colors min-h-[44px]">取消</button>
                <button type="button" onClick={confirmLeave} className="px-4 py-2.5 rounded-lg bg-white text-zinc-950 font-medium text-sm hover:bg-zinc-200 transition-colors min-h-[44px]">离开</button>
              </div>
            </div>
          </div>
        )}
        {logoutConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="logout-confirm-title">
            <div className="rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl max-w-sm w-full p-6 max-h-[90vh] overflow-y-auto">
              <p id="logout-confirm-title" className="text-zinc-200 text-sm mb-6">确定要退出登录吗？</p>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={cancelLogout} className="px-4 py-2.5 rounded-lg border border-zinc-600 text-zinc-300 text-sm hover:bg-zinc-800 transition-colors min-h-[44px]">取消</button>
                <button type="button" onClick={confirmLogout} className="px-4 py-2.5 rounded-lg bg-white text-zinc-950 font-medium text-sm hover:bg-zinc-200 transition-colors min-h-[44px]">退出</button>
              </div>
            </div>
          </div>
        )}
        {/* 顶部导航 - 桌面端显示 */}
        <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm hidden sm:block">
          <div className="container mx-auto px-4 h-14 sm:h-16 flex items-center justify-between max-w-[650px]">
            <nav className="flex items-center sm:space-x-4 md:space-x-6">
              {navItems.map(({ to, label, Icon }) => (
                <NavLink key={to} to={to} label={label} Icon={Icon} variant="top" />
              ))}
            </nav>
            <button
              type="button"
              onClick={handleLogoutClick}
              className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-zinc-200 rounded-full hover:bg-zinc-800 transition-colors touch-manipulation"
              title={userEmail ? `（${userEmail}），点击退出` : '点击退出'}
            >
              <CircleUserRound className="w-5 h-5" />
            </button>
          </div>
        </header>
        {/* 底部导航 - 移动端 */}
        <nav className="fixed bottom-0 left-0 right-0 z-20 sm:hidden border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-sm safe-area-pb">
          <div className="flex items-stretch">
            {navItems.map(({ to, label, Icon }) => (
              <NavLink key={to} to={to} label={label} Icon={Icon} variant="bottom" />
            ))}
            <button
              type="button"
              onClick={handleLogoutClick}
              className="flex flex-col items-center justify-center gap-0.5 py-2 px-4 text-zinc-400 active:text-zinc-200 text-xs min-w-0 touch-manipulation"
              title={userEmail ? `（${userEmail}），点击退出` : '点击退出'}
            >
              <CircleUserRound className="w-5 h-5 flex-shrink-0" />
              <span>退出</span>
            </button>
          </div>
        </nav>
        <main className="container mx-auto max-w-[650px] px-3 sm:px-4 py-6 sm:py-8">
          {tab === 'schedule' && <ScheduleView refreshKey={scheduleRefreshKey} />}
          {tab === 'email' && <EmailRecordsView />}
          {tab === 'admin' && <AdminView />}
          {tab === 'home' && (
            <HomeView
              onUnsavedChange={setHomeUnsavedCount}
              onCoursesSaved={() => setScheduleRefreshKey((k) => k + 1)}
            />
          )}
        </main>
      </div>
    </ToastProvider>
  );
}
