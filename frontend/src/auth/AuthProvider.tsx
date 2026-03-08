import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { ApiError, api, clearToken, setToken, type User } from "../api";

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
    clearToken();
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      try {
        const tokenData = await api.login(username, password);
        setToken(tokenData.token);
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

  // eslint-disable-next-line react-hooks/exhaustive-deps -- run only on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const userInfo = await api.getMe();
        setIsAuthenticated(true);
        setUser(userInfo);
      } catch {
        clearToken();
      }
      setIsLoading(false);
    };
    checkAuthStatus();
  }, []);

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
