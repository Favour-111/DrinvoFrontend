import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertTriangle, Check, Info } from 'lucide-react';

const ToastContext = createContext(null);
let nextId = 1;

const ICON = { success: Check, error: AlertTriangle, info: Info };
const TONE = { success: 'bg-brand-2', error: 'bg-bad', info: 'bg-info' };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (message, type = 'success') => {
      const id = nextId++;
      setToasts((t) => [...t.slice(-3), { id, message, type }]);
      setTimeout(() => dismiss(id), type === 'error' ? 5000 : 3000);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (m) => show(m, 'success'),
      error: (m) => show(m, 'error'),
      info: (m) => show(m, 'info'),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-[calc(92px+env(safe-area-inset-bottom))] z-[200] flex flex-col items-center gap-2 lg:inset-x-auto lg:right-5 lg:bottom-5 lg:items-end"
      >
        {toasts.map((t) => {
          const Icon = ICON[t.type];
          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className="animate-pop pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-[12px] border border-line bg-ink py-3 pr-4 pl-3 text-[13.5px] font-medium text-on-hero shadow-pop"
              onClick={() => dismiss(t.id)}
            >
              <span className={`grid size-[26px] flex-none place-items-center rounded-[8px] text-white ${TONE[t.type]}`}>
                <Icon size={15} />
              </span>
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
