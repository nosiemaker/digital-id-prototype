import axios, { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { APIError, RefreshResponse } from '../utils/types';

/**
 * Token store — thin wrapper over localStorage.
 * Replace with SecureStorage (Capacitor) for the mobile app build.
 */
const TOKEN_KEY   = 'zdid_access_token';
const REFRESH_KEY = 'zdid_refresh_token';
const ROLE_KEY    = 'zdid_user_role';
const NAME_KEY    = 'zdid_user_name';
const PRIV_KEY    = 'zdid_private_key'; // ECDSA P-256 private key

export const tokenStore = {
  getAccess: (): string | null => localStorage.getItem(TOKEN_KEY),
  getRefresh: (): string | null => localStorage.getItem(REFRESH_KEY),
  getRole: (): string | null => localStorage.getItem(ROLE_KEY),
  getName: (): string | null => localStorage.getItem(NAME_KEY),
  getPrivKey: (): string | null => localStorage.getItem(PRIV_KEY),

  set: (access: string, refresh: string, role: string, name?: string): void => {
    const normalizedRole = role.replace(/\s+/g, '_').toUpperCase();
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(ROLE_KEY, normalizedRole);
    if (name) {
      localStorage.setItem(NAME_KEY, name);
    }
  },

  setPrivKey: (pkcs8B64: string): void => {
    localStorage.setItem(PRIV_KEY, pkcs8B64);
  },

  setName: (name: string): void => localStorage.setItem(NAME_KEY, name),
  setRole: (role: string): void => {
    const normalizedRole = role.replace(/\s+/g, '_').toUpperCase();
    localStorage.setItem(ROLE_KEY, normalizedRole);
  },

  clear: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(NAME_KEY);
    // NOTE: private key is intentionally NOT cleared on logout
    // so the citizen can still sign challenges after re-login.
    if (typeof refreshState !== 'undefined' && refreshState.reset) {
      refreshState.reset();
    }
  },
};

// ── Axios instance ────────────────────────────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';

export const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// Request interceptor — attach Bearer token
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStore.getAccess();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error),
);

// Session-expired event — named correctly now
export const SESSION_EXPIRED_EVENT = 'zdid:session_expired' as const;

function signalSessionExpired() {
  tokenStore.clear();
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

// Response interceptor — silent token refresh on 401
const refreshState = (() => {
  let isRefreshing = false;
  let refreshQueue: Array<{
    resolve: (token: string) => void;
    reject: (err: unknown) => void;
  }> = [];

  return {
    get isRefreshing() {
      return isRefreshing;
    },
    set isRefreshing(value: boolean) {
      isRefreshing = value;
    },
    get refreshQueue() {
      return refreshQueue;
    },
    addToQueue: (item: { resolve: (token: string) => void; reject: (err: unknown) => void }) => {
      refreshQueue.push(item);
    },
    drainQueue: (token: string | null, error: unknown = null) => {
      refreshQueue.forEach(({ resolve, reject }) => {
        if (token) resolve(token);
        else reject(error);
      });
      refreshQueue = [];
    },
    reset: () => {
      isRefreshing = false;
      refreshQueue = [];
    },
  };
})();

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(normaliseError(error));
    }

    if (original.url?.includes('/auth/refresh')) {
      signalSessionExpired();
      return Promise.reject(normaliseError(error));
    }

    if (refreshState.isRefreshing) {
      return new Promise<AxiosResponse>((resolve, reject) => {
        refreshState.addToQueue({
          resolve: (token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(axiosInstance(original));
          },
          reject,
        });
      });
    }

    original._retry = true;
    refreshState.isRefreshing = true;

    const refreshToken = tokenStore.getRefresh();
    if (!refreshToken) {
      refreshState.isRefreshing = false;
      signalSessionExpired();
      return Promise.reject(normaliseError(error));
    }

    try {
      const { data } = await axios.post<RefreshResponse>(
        `${API_BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken },
      );
      const currentRole = tokenStore.getRole() || '';
      const currentName = tokenStore.getName() || '';
      tokenStore.set(data.access_token, data.refresh_token, currentRole, currentName);
      axiosInstance.defaults.headers.common.Authorization = `Bearer ${data.access_token}`;
      refreshState.drainQueue(data.access_token);
      original.headers.Authorization = `Bearer ${data.access_token}`;
      return axiosInstance(original);
    } catch (refreshError) {
      refreshState.drainQueue(null, refreshError);
      signalSessionExpired();
      return Promise.reject(normaliseError(error));
    } finally {
      refreshState.isRefreshing = false;
    }
  },
);

function normaliseError(error: AxiosError): APIError {
  const responseData = error.response?.data as Record<string, unknown> | undefined;

  let detail = 'An unexpected error occurred';
  let validationErrors: Record<string, string[]> | undefined;
  let code: string | undefined;

  if (responseData) {
    if (typeof responseData.detail === 'string') {
      detail = responseData.detail;
    } else if (Array.isArray(responseData.detail)) {
      detail = 'Validation failed';
      validationErrors = {};
      (responseData.detail as Array<{ loc: string[]; msg: string }>).forEach((err) => {
        if (err.loc && err.msg) {
          const field = err.loc[err.loc.length - 1];
          if (!validationErrors![field]) validationErrors![field] = [];
          validationErrors![field].push(err.msg);
        }
      });
    } else if (typeof responseData.message === 'string') {
      detail = responseData.message;
    }
    if (typeof responseData.code === 'string') {
      code = responseData.code;
    }
  } else if (error.message) {
    detail = error.message;
  }

  if (error.code === 'ECONNABORTED') {
    detail = 'Request timeout. Please check your connection and try again.';
  } else if (error.code === 'ERR_NETWORK') {
    detail = 'Network error. Please check your internet connection.';
  }

  return {
    detail,
    status: error.response?.status ?? 0,
    ...(code && { code }),
    ...(validationErrors && { validationErrors }),
  };
}
