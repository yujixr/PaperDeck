// frontend/src/auth/AuthProvider.tsx
import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import {
    AuthApi,
    type LoginPayload,
    type AuthToken,
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

    // JWTをlocalStorageに保存し、認証状態を更新するヘルパー
    const saveAuthData = (token: AuthToken, userInfo: User) => {
        localStorage.setItem(JWT_STORAGE_KEY, token.token);
        setIsAuthenticated(true);
        setUser(userInfo);
    };

    // ログアウト処理
    const logout = useCallback(() => {
        localStorage.removeItem(JWT_STORAGE_KEY);
        setIsAuthenticated(false);
        setUser(null);
        // ログアウト時にトップページ/ログインページにリダイレクトしたい場合は、
        // useAuthを使うコンポーネント側で <Navigate to="/login" /> を実行します。
    }, []);

    // ログインAPI呼び出し
    const login = useCallback(async (payload: LoginPayload) => {
        try {
            // uthApiのメソッドを直接呼び出し
            const { token, tokenType } = await authApi.login({ loginPayload: payload });

            // TODO: ユーザー情報取得ロジック
            // 現状、/login はトークンのみを返し、ユーザー情報を返さない。
            // 本来は /api/me のようなエンドポイントを叩くか、JWTをデコードすべき。
            // ここではダミーデータを使用する。
            const dummyUser: User = { userId: 1, username: payload.username };
            saveAuthData({ token, tokenType }, dummyUser);

        } catch (error) {
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
    // 既にConfigurationにaccessToken関数を渡しているため、
    // 認証が必要なAPIコールの失敗はResponseErrorとして処理されるべき
    useEffect(() => {
        const token = localStorage.getItem(JWT_STORAGE_KEY);
        if (token) {
            // 本来はトークンをデコードしてユーザーIDを取得
            // ここではダミーデータ（デコード仮定）
            const dummyUser: User = { userId: 1, username: 'ログインユーザー' };
            setIsAuthenticated(true);
            setUser(dummyUser);
        }
        setIsLoading(false);
    }, []);

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