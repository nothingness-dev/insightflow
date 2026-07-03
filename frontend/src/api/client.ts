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


api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;


    const isRefreshEndpoint = original?.url?.includes('/auth/refresh/');
    if (error.response?.status === 401 && !original._retry && !isRefreshEndpoint) {
      original._retry = true;
      try {
        const refresh = authTokenStore.getRefreshToken();
        if (!refresh) throw new Error('No refresh token');
        const res = await axios.post('/api/auth/refresh/', { refresh });
        const newAccess = res.data.access;
        authTokenStore.setAccessToken(newAccess);
        api.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`;
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
