// frontend/src/pages/RegisterPage.tsx
import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { Link, useNavigate } from 'react-router-dom';
import { ResponseError } from '../api'; // APIクライアントのエラー型
import { AuthForm } from '../components/AuthForm';

/**
 * 登録ページコンポーネント
 * フォームでユーザー名とパスワードを受け取り、登録ロジックを実行します。
 */
export function RegisterPage() {
    const { register, login } = useAuth();
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // フォームが有効か（両方のフィールドが空でないか）をメモ化
    const isFormValid = useMemo(() => {
        return username.trim() !== '' && password.trim() !== '';
    }, [username, password]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setIsSubmitting(true);

        try {
            // ステップ 1: 登録を実行
            await register({ username, password });

            // 成功メッセージを更新
            setSuccessMessage('登録が成功しました。自動的にログインしています...');

            // ステップ 2: 登録成功後、自動ログインを実行
            await login({ username, password });

            // ステップ 3: ログイン成功後、ホームページにリダイレクト
            navigate('/', { replace: true });

        } catch (err) {
            console.error("Registration Error:", err);

            if (err instanceof ResponseError) {
                const status = err.response.status;

                if (status === 409) {
                    setError("このユーザー名は既に使用されています。");
                } else if (status === 400) {
                    // 400 (Bad Request) の場合、サーバーからのメッセージを表示
                    try {
                        // バックエンドは (StatusCode, String) を返すので、text() で取得
                        const serverMessage = await err.response.text();
                        setError(serverMessage || "入力内容が正しくありません。");
                    } catch (textErr) {
                        setError("入力内容が正しくありません。");
                    }
                } else if (status === 401) {
                    // 自動ログイン（login呼び出し）に失敗した場合
                    setError("登録には成功しましたが、自動ログインに失敗しました。ログインページから手動でログインしてください。");
                } else {
                    // その他のHTTPエラー
                    const errorMessage = err.message || `エラーが発生しました (コード: ${status})。`;
                    setError(errorMessage);
                }
            } else {
                // ResponseError ではない場合 (ネットワークエラーなど)
                const errorMessage = err instanceof Error ? err.message : "登録中に不明なエラーが発生しました。";
                setError(errorMessage);
            }
            setIsSubmitting(false);
        }
    }, [register, login, username, password, navigate]);

    return (
        <div className="form-container">
            <h1>ユーザー登録</h1>

            <AuthForm
                username={username}
                setUsername={setUsername}
                password={password}
                setPassword={setPassword}
                isSubmitting={isSubmitting}
                isFormValid={isFormValid}
                errorMessage={error}
                successMessage={successMessage}
                submitButtonText="登録"
                submitButtonLoadingText="登録中..."
                onSubmit={handleSubmit}
            />

            <p>
                すでにアカウントをお持ちですか？ <Link to="/login">ログインはこちら</Link>
            </p>
        </div>
    );
}