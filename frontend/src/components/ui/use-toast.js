import * as React from 'react';

const ToastContext = React.createContext(null);
const TOAST_LIMIT = 3;

export const ToastContextProvider = ({ children }) => {
  const [toasts, setToasts] = React.useState([]);

  const toast = React.useCallback(({ title, description }) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => {
      const next = [...prev, { id, title, description }];
      return next.slice(-TOAST_LIMIT);
    });
    return id;
  }, []);

  const dismiss = React.useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastContextProvider');
  }
  return context;
};
