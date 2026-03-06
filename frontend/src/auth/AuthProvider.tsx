import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { ApiError, api, type User } from "../api";
import { JWT_STORAGE_KEY } from "../lib/apiConfig";

type AuthContextType = {
  isAuthenticated: boolean;
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<User>;
  logout: () => void;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    api.logout().catch(() => {});
    localStorage.removeItem(JWT_STORAGE_KEY);
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      try {
        const tokenData = await api.login(username, password);
        localStorage.setItem(JWT_STORAGE_KEY, tokenData.token);
        const userInfo = await api.getMe();
        setIsAuthenticated(true);
        setUser(userInfo);
      } catch (error) {
        logout();
        if (error instanceof ApiError && error.status === 401) {
          throw new Error("ユーザー名またはパスワードが正しくありません");
        }
        throw error;
      }
    },
    [logout],
  );

  const register = useCallback(async (username: string, password: string) => {
    return api.register(username, password);
  }, []);

  useEffect(() => {
    const checkAuthStatus = async () => {
      const token = localStorage.getItem(JWT_STORAGE_KEY);
      if (token) {
        try {
          const userInfo = await api.getMe();
          setIsAuthenticated(true);
          setUser(userInfo);
        } catch {
          logout();
        }
      }
      setIsLoading(false);
    };
    checkAuthStatus();
  }, [logout]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
