import { Navigate, Outlet, Route, Routes } from "react-router";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { Layout } from "./components/Layout";
import { ConferenceFilterProvider } from "./context/ConferenceFilterContext";
import { HomePage } from "./pages/HomePage";
import { LikedPapersPage } from "./pages/LikedPapersPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { StatsPage } from "./pages/StatsPage";

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return <div>認証情報を読み込み中...</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />}
      />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/liked" element={<LikedPapersPage />} />
          <Route path="/stats" element={<StatsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<h1>404 Not Found</h1>} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ConferenceFilterProvider>
        <AppRoutes />
      </ConferenceFilterProvider>
    </AuthProvider>
  );
}
