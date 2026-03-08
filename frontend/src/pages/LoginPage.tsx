import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/Button";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFormValid = useMemo(() => {
    return username.trim() !== "" && password.trim() !== "";
  }, [username, password]);

  const handleSubmit = useCallback(
    async (e: React.SubmitEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      setIsSubmitting(true);

      try {
        await login(username, password);
        navigate("/", { replace: true });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "ログイン中に不明なエラーが発生しました。";
        setError(errorMessage);
        setIsSubmitting(false);
      }
    },
    [login, username, password, navigate],
  );

  return (
    <AuthLayout>
      <div className="form-container">
        <h2>ログイン</h2>

        <div className="form-card">
          <form onSubmit={handleSubmit}>
            {error && <p className="status-message status-message-error">{error}</p>}

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

            <Button type="submit" size="large" fullWidth disabled={isSubmitting || !isFormValid}>
              {isSubmitting ? "ログイン中..." : "ログイン"}
            </Button>
          </form>
        </div>

        <p>
          アカウントをお持ちでないですか？ <Link to="/register">登録はこちら</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
