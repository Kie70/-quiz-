import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

const TOAST_TTL_MS = 4000;

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const toast = useCallback((message, type = 'error', options = {}) => {
    const id = Date.now();
    const duration = options.duration ?? TOAST_TTL_MS;
    setItems((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg ${
              t.type === 'error'
                ? 'bg-red-950/95 border-red-800 text-red-200'
                : t.type === 'success'
                  ? 'bg-emerald-950/95 border-emerald-800 text-emerald-200'
                  : 'bg-zinc-900/95 border-zinc-700 text-zinc-200'
            }`}
            role="alert"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { toast: (msg) => alert(msg) };
  return ctx;
}
