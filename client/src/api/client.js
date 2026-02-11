import axios from 'axios';

// 部署到 ECS/任意域名时用相对路径 /api；仅在本机 localhost 开发时指向 5000 端口
const baseURL = import.meta.env.VITE_API_BASE_URL ?? (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api');
const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      try {
        sessionStorage.setItem('logout_reason', 'expired');
      } catch (_) {}
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

export default api;
