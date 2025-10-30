// frontend/src/components/AuthForm.tsx
import type { FormEvent } from 'react';
import { Form } from './Form';
import './AuthForm.css';

/**
 * AuthForm コンポーネントのProps
 * フォームの状態とイベントハンドラを親コンポーネント (LoginPage/RegisterPage) から受け取ります。
 */
interface AuthFormProps {
    // フォームの状態
    username: string;
    setUsername: (value: string) => void;
    password: string;
    setPassword: (value: string) => void;

    // 送信状態
    isSubmitting: boolean;
    isFormValid: boolean;

    // 表示メッセージ
    errorMessage: string | null;
    successMessage?: string | null; // RegisterPage のみ使用

    // ボタンのテキスト
    submitButtonText: string;
    submitButtonLoadingText: string;

    // イベントハンドラ
    onSubmit: (e: FormEvent) => void;
}

/**
 * ログイン/登録ページで共通利用するフォームUIコンポーネント
 * 状態やロジックは持たず、props として受け取ったものを描画します。
 */
export function AuthForm({
    username,
    setUsername,
    password,
    setPassword,
    isSubmitting,
    isFormValid,
    errorMessage,
    successMessage,
    submitButtonText,
    submitButtonLoadingText,
    onSubmit,
}: AuthFormProps) {
    return (
        <Form
            onSubmit={onSubmit}
            errorMessage={errorMessage}
            successMessage={successMessage}
            isSubmitting={isSubmitting}
            isFormValid={isFormValid}
            submitButtonText={submitButtonText}
            submitButtonLoadingText={submitButtonLoadingText}
        >
            {/* children としてフォームの「中身」を渡す */}
            <div className="form-group">
                <label htmlFor="username">ユーザー名:</label>
                <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={isSubmitting}
                />
            </div>

            <div className="form-group">
                <label htmlFor="password">パスワード:</label>
                <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isSubmitting}
                />
            </div>
        </Form>);
}