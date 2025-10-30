// frontend/src/pages/LoginPage.tsx
import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { Link, useNavigate } from 'react-router-dom';
import { AuthForm } from '../components/AuthForm';

/**
 * ログインページコンポーネント
 * フォームでユーザー名とパスワードを受け取り、認証ロジックを実行します。
 */
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFormValid = useMemo(() => {
    return username.trim() !== '' && password.trim() !== '';
  }, [username, password]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ username, password });
      // ログイン成功したら、HomePage (/) へリダイレクト
      navigate('/', { replace: true });
    } catch (err) {
      console.error("Login Error:", err);
      // AuthProvider で定義された特定のエラーメッセージを取得
      const errorMessage = err instanceof Error ? err.message : "ログイン中に不明なエラーが発生しました。";
      setError(errorMessage);
      setIsSubmitting(false);
    }
  }, [login, username, password, navigate]);

  return (
    < div className="form-container" >
      <h1>ログイン</h1>

      <AuthForm
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        isSubmitting={isSubmitting}
        isFormValid={isFormValid}
        errorMessage={error}
        submitButtonText="ログイン"
        submitButtonLoadingText="ログイン中..."
        onSubmit={handleSubmit}
      />

      <p>
        アカウントをお持ちでないですか？ <Link to="/register">登録はこちら</Link>
      </p>
    </div >
  );
}