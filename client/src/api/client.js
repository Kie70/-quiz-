import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');
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
