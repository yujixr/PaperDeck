// frontend/src/App.tsx
import { useAuth, AuthProvider } from './auth/AuthProvider';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { LikedPapersPage } from './pages/LikedPapersPage';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { Layout } from './components/Layout';

// ------------------------------------
// 1. 認証が必要なルートを定義するコンポーネント
// ------------------------------------
// 認証されていないユーザーをログインページにリダイレクトします
function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    // ロード中は何も表示しない、またはローディング画面を表示
    return <div>認証情報を読み込み中...</div>;
  }

  // 認証されていなければログインページへリダイレクト
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 認証されていれば子コンポーネントを表示
  return <Outlet />;
}

// ------------------------------------
// 2. メインのルーティングコンポーネント
// ------------------------------------
function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* 認証が不要なルート */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />}
      />

      {/* * 2. 認証が必要なルート 
        * ProtectedRoute で認証をチェックし、
        * 子要素として Layout コンポーネントを配置します。
        * Layout はナビゲーションバーを表示し、
        * その子ルート (HomePage など) を <Outlet> に描画します。
      */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          {/* 以下のルートは Layout の <Outlet> 内に表示されます */}
          <Route path="/" element={<HomePage />} />
          <Route path="/liked" element={<LikedPapersPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Route>

      {/* その他のルート (404 Not Found など) は後で追加 */}
      <Route path="*" element={<h1>404 Not Found</h1>} />
    </Routes>
  );
}

// ------------------------------------
// 3. アプリケーション全体のエントリーポイント
// ------------------------------------
export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
