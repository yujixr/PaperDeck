// frontend/src/lib/apiConfig.ts
import { Configuration } from '../api';

/**
 * localStorage に JWT トークンを保存・読み込みするためのキー
 * AuthProvider でもこのキーを参照するようにします
 */
export const JWT_STORAGE_KEY = 'jwt_token';

/**
 * すべてのAPIクライアントで共有される設定
 * - basePath: APIサーバーのURL (.env から取得)
 * - accessToken: localStorage から自動でトークンを読み込む関数
 */
export const apiConfig = new Configuration({
    basePath: import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000',
    accessToken: () => localStorage.getItem(JWT_STORAGE_KEY) || '',
});