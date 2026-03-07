import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ApiError } from "../api";
import { useAuth } from "../auth/AuthProvider";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/Button";

export function RegisterPage() {
  const { register, login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFormValid = useMemo(() => {
    return username.trim() !== "" && password.trim() !== "";
  }, [username, password]);

  const handleSubmit = useCallback(
    async (e: React.SubmitEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      setSuccessMessage(null);
      setIsSubmitting(true);

      try {
        await register(username, password);
        setSuccessMessage("登録が成功しました。自動的にログインしています...");
        await login(username, password);
        navigate("/", { replace: true });
      } catch (err) {
        console.error("Registration Error:", err);

        if (err instanceof ApiError) {
          if (err.status === 409) {
            setError("このユーザー名は既に使用されています。");
          } else if (err.status === 400) {
            setError(err.message || "入力内容が正しくありません。");
          } else if (err.status === 401) {
            setError(
              "登録には成功しましたが、自動ログインに失敗しました。ログインページから手動でログインしてください。",
            );
          } else {
            setError(err.message || `エラーが発生しました (コード: ${err.status})。`);
          }
        } else {
          const errorMessage =
            err instanceof Error ? err.message : "登録中に不明なエラーが発生しました。";
          setError(errorMessage);
        }
        setIsSubmitting(false);
      }
    },
    [register, login, username, password, navigate],
  );

  return (
    <AuthLayout>
      <div className="form-container">
        <h2>ユーザー登録</h2>

        <div className="form-card">
          <form onSubmit={handleSubmit}>
            {successMessage && (
              <p className="status-message status-message-success">{successMessage}</p>
            )}
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
              {isSubmitting ? "登録中..." : "登録"}
            </Button>
          </form>
        </div>

        <p>
          すでにアカウントをお持ちですか？ <Link to="/login">ログインはこちら</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
