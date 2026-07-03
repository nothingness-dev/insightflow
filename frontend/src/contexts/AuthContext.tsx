import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import api, { authTokenStore, refreshAccessToken } from '../api/client';

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
    const hasRefreshToken = Boolean(authTokenStore.getRefreshToken());

    if (savedUser && hasRefreshToken) {
      setUser(JSON.parse(savedUser));
      // The in-memory access token doesn't survive a page reload, so every
      // component that fetches data on mount would otherwise fire its first
      // request unauthenticated, get a 401, and independently trigger a
      // refresh — the exact race that can prematurely blacklist the refresh
      // token and log the user out. Refresh once, proactively, before any
      // page-level requests go out.
      refreshAccessToken()
        .then(token => setAccessToken(token))
        .catch(() => {
          authTokenStore.clear();
          setUser(null);
        })
        .finally(() => setIsLoading(false));
      return;
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
