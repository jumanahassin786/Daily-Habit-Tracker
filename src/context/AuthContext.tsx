import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  authAPI,
  authStorage,
  type AuthUser,
} from '../lib/api';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore authentication after page refresh
  useEffect(() => {
    const restoreSession = async () => {
      const token = authStorage.getToken();

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        // Verify stored token using the protected backend API.
        // A dedicated /me endpoint will be added to the backend.
        const response = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          authStorage.clearToken();
          setUser(null);
          return;
        }

        const data = await response.json();
        setUser(data.user);
      } catch {
        authStorage.clearToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void restoreSession();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await authAPI.login(email, password);

    authStorage.setToken(data.token);
    setUser(data.user);
  };

  const register = async (
    name: string,
    email: string,
    password: string
  ) => {
    const data = await authAPI.register(name, email, password);

    authStorage.setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    authStorage.clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}