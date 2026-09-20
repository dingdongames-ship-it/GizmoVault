import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast" role="alert">
            {toast.type === 'success' && <CheckCircle2 size={20} color="var(--color-success)" />}
            {toast.type === 'error' && <AlertCircle size={20} color="var(--color-danger)" />}
            {toast.type === 'info' && <Info size={20} color="var(--accent-cyan)" />}
            {toast.type === 'warning' && <AlertCircle size={20} color="var(--color-warning, #f59e0b)" />}
            <span style={{ fontSize: '0.875rem', fontWeight: 500, flex: 1 }}>{toast.message}</span>
            <button 
              onClick={() => removeToast(toast.id)} 
              className="btn btn-ghost btn-icon" 
              style={{ width: 24, height: 24 }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};
