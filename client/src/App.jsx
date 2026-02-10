import { useState, useEffect } from 'react';
import { CircleUserRound } from 'lucide-react';
import { ToastProvider } from './context/ToastContext';
import LoginView from './views/LoginView';
import HomeView from './views/HomeView';
import ScheduleView from './views/ScheduleView';
import EmailRecordsView from './views/EmailRecordsView';

const TOKEN_KEY = 'token';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [tab, setTab] = useState('home');
  const [homeUnsavedCount, setHomeUnsavedCount] = useState(0);
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0);
  const [leaveConfirmTarget, setLeaveConfirmTarget] = useState(null);

  useEffect(() => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
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

  const NavLink = ({ to, label }) => {
    const isActive = tab === to;
    return (
      <button
        type="button"
        onClick={() => handleTabChange(to)}
        className={`text-sm font-medium h-16 flex items-center transition-colors relative px-1 ${
          isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        {label}
        {isActive && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-white" />}
      </button>
    );
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased">
        {leaveConfirmTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="leave-confirm-title">
            <div className="rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl max-w-sm w-full p-6">
              <p id="leave-confirm-title" className="text-zinc-200 text-sm mb-6">当前修改未保存，是否离开？</p>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={cancelLeave} className="px-4 py-2 rounded-lg border border-zinc-600 text-zinc-300 text-sm hover:bg-zinc-800 transition-colors">取消</button>
                <button type="button" onClick={confirmLeave} className="px-4 py-2 rounded-lg bg-white text-zinc-950 font-medium text-sm hover:bg-zinc-200 transition-colors">离开</button>
              </div>
            </div>
          </div>
        )}
        <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-[650px]">
            <nav className="flex items-center space-x-8">
              <NavLink to="home" label="主页" />
              <NavLink to="schedule" label="课程表" />
              <NavLink to="email" label="邮件记录" />
            </nav>
            <button
              type="button"
              onClick={() => { setToken(null); }}
              className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-zinc-200 rounded-full hover:bg-zinc-800 transition-colors"
              title="已登录，点击退出"
            >
              <CircleUserRound className="w-5 h-5" />
            </button>
          </div>
        </header>
        <main className="container mx-auto max-w-[650px] px-4 py-8">
          {tab === 'schedule' && <ScheduleView refreshKey={scheduleRefreshKey} />}
          {tab === 'email' && <EmailRecordsView />}
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
