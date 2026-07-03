import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import api, { authTokenStore } from '../api/client';

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (partial: Partial<User>) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedUser = authTokenStore.getSavedUser();
    if (savedUser && authTokenStore.getRefreshToken()) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.post('/auth/login/', { username, password });
    const { access, refresh, user: userData } = res.data;
    setAccessToken(access);
    setUser(userData);
    authTokenStore.setAccessToken(access);
    authTokenStore.setRefreshToken(refresh);
    authTokenStore.setSavedUser(JSON.stringify(userData));
    api.defaults.headers.common['Authorization'] = `Bearer ${access}`;
    return userData;
  };

  const updateUser = (partial: Partial<User>) => {
    setUser(prev => {
      const next = prev ? { ...prev, ...partial } : prev;
      if (next) authTokenStore.setSavedUser(JSON.stringify(next));
      return next;
    });
  };

  const logout = async () => {
    try {
      const refresh = authTokenStore.getRefreshToken();
      if (refresh && !authTokenStore.getAccessToken()) {
        const res = await api.post('/auth/refresh/', { refresh });
        const newAccess = res.data.access;
        authTokenStore.setAccessToken(newAccess);
        api.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`;
      }
      if (refresh) await api.post('/auth/logout/', { refresh });
    } catch {}
    setUser(null);
    setAccessToken(null);
    authTokenStore.clear();
    delete api.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, updateUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
