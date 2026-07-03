import axios from 'axios';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user';

let accessToken: string | null = null;

function clearLegacyLocalStorage() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export const authTokenStore = {
  getAccessToken() {
    return accessToken;
  },
  setAccessToken(token: string | null) {
    accessToken = token;
  },
  getRefreshToken() {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setRefreshToken(token: string | null) {
    if (token) {
      sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    }
    clearLegacyLocalStorage();
  },
  getSavedUser() {
    return sessionStorage.getItem(USER_KEY);
  },
  setSavedUser(user: string | null) {
    if (user) {
      sessionStorage.setItem(USER_KEY, user);
    } else {
      sessionStorage.removeItem(USER_KEY);
    }
    clearLegacyLocalStorage();
  },
  clear() {
    accessToken = null;
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    clearLegacyLocalStorage();
  },
};

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});


api.interceptors.request.use((config) => {
  const token = authTokenStore.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// SIMPLE_JWT has ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION enabled on the
// backend, which means each refresh call both issues a new refresh token AND
// blacklists the one that was used. If two requests 401 around the same time
// (e.g. right after a hard reload, when several components fetch data in
// parallel and the in-memory access token hasn't been restored yet) and each
// independently calls /auth/refresh/ with the same refresh token, only the
// first call succeeds — the second arrives after the token has already been
// rotated/blacklisted, fails, and used to wipe the session and force a
// redirect to /login even though the user was never actually logged out.
// `refreshPromise` makes every concurrent 401 await the same in-flight
// refresh call instead of racing separate ones, and the rotated refresh
// token from the response is persisted so the *next* refresh doesn't fail.
let refreshPromise: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refresh = authTokenStore.getRefreshToken();
      if (!refresh) throw new Error('No refresh token');
      const res = await axios.post('/api/auth/refresh/', { refresh });
      const newAccess: string = res.data.access;
      authTokenStore.setAccessToken(newAccess);
      if (res.data.refresh) authTokenStore.setRefreshToken(res.data.refresh);
      api.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`;
      return newAccess;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;


    const isRefreshEndpoint = original?.url?.includes('/auth/refresh/');
    if (error.response?.status === 401 && !original._retry && !isRefreshEndpoint) {
      original._retry = true;
      try {
        const newAccess = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch {
        authTokenStore.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
