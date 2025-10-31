// frontend/src/auth/AuthProvider.tsx
import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import {
    AuthApi,
    type LoginPayload,
    type RegisterPayload,
    type User,
    ResponseError
} from '../api';
import { apiConfig, JWT_STORAGE_KEY } from '../lib/apiConfig';

// ------------------------------------
// 1. Context の定義
// ------------------------------------
type AuthContextType = {
    isAuthenticated: boolean;
    user: User | null;
    login: (payload: LoginPayload) => Promise<void>;
    register: (payload: RegisterPayload) => Promise<User>;
    logout: () => void;
    isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ------------------------------------
// 2. AuthProvider コンポーネント
// ------------------------------------

// 共有の apiConfig を使って AuthApi のインスタンスを作成
const authApi = new AuthApi(apiConfig);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // ログアウト処理 (login と useEffect より先に定義)
    // 依存関係がないため、useCallback でメモ化
    const logout = useCallback(() => {
        localStorage.removeItem(JWT_STORAGE_KEY);
        setIsAuthenticated(false);
        setUser(null);
    }, []);

    // ログインAPI呼び出し
    const login = useCallback(async (payload: LoginPayload) => {
        try {
            // 1. ログインしてトークンを取得
            const tokenData = await authApi.login({ loginPayload: payload });

            // 2. ユーザー情報を取得する前にトークンを保存
            //    (getMe がこのトークンを使うため)
            localStorage.setItem(JWT_STORAGE_KEY, tokenData.token);

            // 3. /api/me を叩いて実際のユーザー情報を取得
            const userInfo = await authApi.getMe();

            // 4. 状態を更新
            setIsAuthenticated(true);
            setUser(userInfo);

        } catch (error) {
            // エラーが発生したら、保存したかもしれないトークンを削除
            logout();

            // Generatorクライアントのエラーハンドリング
            if (error instanceof ResponseError && error.response.status === 401) {
                // 認証失敗（ユーザー名/パスワード違い）
                throw new Error("ユーザー名またはパスワードが正しくありません");
            }
            throw error; // その他のエラーを再スロー
        }
    }, [logout]); // logoutを依存関係に含める

    // 登録API呼び出し
    const register = useCallback(async (payload: RegisterPayload) => {
        const registeredUser = await authApi.register({ registerPayload: payload });
        return registeredUser;
    }, []);

    // アプリケーション起動時にトークンをチェック
    useEffect(() => {
        // 非同期の認証チェック関数を定義
        const checkAuthStatus = async () => {
            const token = localStorage.getItem(JWT_STORAGE_KEY);
            if (token) {
                try {
                    // トークンを使って /api/me を呼び出し、ユーザー情報を取得
                    const userInfo = await authApi.getMe();
                    // 成功： 認証状態を設定
                    setIsAuthenticated(true);
                    setUser(userInfo);
                } catch (error) {
                    // 失敗 (トークン切れなど)： ログアウト処理
                    console.warn("Invalid token found, logging out.", error);
                    logout();
                }
            }
            // トークンの有無に関わらず、ロード完了
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

// ------------------------------------
// 3. カスタムフック
// ------------------------------------
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}