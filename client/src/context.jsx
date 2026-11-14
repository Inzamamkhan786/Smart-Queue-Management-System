import { createContext, useContext, useEffect, useState } from 'react';
import api from './api.js';

const Context = createContext(null);
export const useApp = () => useContext(Context);

export function AppProvider({ children }) {
  const [manager, setManager] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('queueflow-theme') || 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('queueflow-theme', theme);
  }, [theme]);

  useEffect(() => {
    api.get('/auth/me').then(({ data }) => setManager(data.manager))
      .catch(() => setManager(null)).finally(() => setAuthLoading(false));
  }, []);

  const value = {
    manager, setManager, authLoading, theme,
    toggleTheme: () => setTheme((current) => current === 'light' ? 'dark' : 'light'),
    signOut: async () => { await api.post('/auth/logout'); setManager(null); }
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
