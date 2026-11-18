import type { Habit, CheckStatus } from '../types';

const API_URL = '/api';
const TOKEN_KEY = 'ticked.auth.token';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token: string;
  user: AuthUser;
}

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),

  setToken: (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken: () => {
    localStorage.removeItem(TOKEN_KEY);
  },
};

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  [key: string]: unknown;
}

export interface CheckRecord {
  habitId: string;
  date: string;
  status: CheckStatus;
}

export interface HabitPayload {
  name: string;
  icon: string;
  color: string;
  note?: string;
  weeklyTarget?: number;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = authStorage.getToken();

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'API request failed');
  }

  return data as T;
}

// AUTH API
export const authAPI = {
  register: (
    name: string,
    email: string,
    password: string
  ) =>
    apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email: string, password: string) =>
    apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
};

// HABIT API
export const habitAPI = {
  getAll: async (): Promise<Habit[]> => {
    const data = await apiRequest<{ habits: Habit[] }>('/habits');
    return data.habits;
  },

  create: async (habit: HabitPayload): Promise<Habit> => {
    const data = await apiRequest<{ habit: Habit }>('/habits', {
      method: 'POST',
      body: JSON.stringify(habit),
    });
    return data.habit;
  },

  update: async (
    id: string,
    habit: Partial<HabitPayload>
  ): Promise<Habit> => {
    const data = await apiRequest<{ habit: Habit }>(`/habits/${id}`, {
      method: 'PUT',
      body: JSON.stringify(habit),
    });
    return data.habit;
  },

  delete: async (id: string) => {
    return apiRequest<ApiResponse<null>>(`/habits/${id}`, {
      method: 'DELETE',
    });
  },

  reorder: async (habitIds: string[]) => {
    return apiRequest<ApiResponse<null>>('/habits/reorder', {
      method: 'POST',
      body: JSON.stringify({ habitIds }),
    });
  },
};

// CHECK API
export const checkAPI = {
  getAll: async (): Promise<CheckRecord[]> => {
    const data = await apiRequest<{ checks: CheckRecord[] }>('/checks');
    return data.checks;
  },

  save: async (
    habitId: string,
    date: string,
    status: CheckStatus
  ) => {
    return apiRequest<ApiResponse<null>>('/checks', {
      method: 'POST',
      body: JSON.stringify({ habitId, date, status }),
    });
  },

  delete: async (habitId: string, date: string) => {
    return apiRequest<ApiResponse<null>>(
      `/checks/${habitId}/${date}`,
      { method: 'DELETE' }
    );
  },

  markAllDone: async (habitIds: string[], date: string) => {
    return apiRequest<ApiResponse<null>>('/checks/bulk', {
      method: 'POST',
      body: JSON.stringify({ habitIds, date }),
    });
  },

  clearDay: async (date: string) => {
    return apiRequest<ApiResponse<null>>(`/checks/day/${date}`, {
      method: 'DELETE',
    });
  },
};