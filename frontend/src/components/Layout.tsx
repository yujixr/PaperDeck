// frontend/src/components/Layout.tsx
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button } from './Button';
import './Layout.css';

/**
 * 共有のナビゲーションバーを含むレイアウトコンポーネント。
 * 認証済みページ (Home, Liked, Admin) は、このレイアウト内に表示されます。
 */
export function Layout() {
    const { logout } = useAuth();

    const handleLogout = () => {
        logout();
    };

    return (
        <div className="app-layout">
            {/* --- ナビゲーションバー --- */}
            <header className="navbar">
                <div className="nav-brand">
                    <NavLink to="/">PaperDeck</NavLink>
                </div>

                {/* --- ページリンク --- */}
                <nav className="nav-links">
                    {/* 'end' prop は、"/" に完全に一致する場合のみ active にします */}
                    <NavLink to="/" end>
                        ホーム
                    </NavLink>
                    <NavLink to="/liked">いいね一覧</NavLink>
                    <NavLink to="/admin">管理</NavLink>
                </nav>

                {/* --- ログアウトボタン --- */}
                <div className="nav-actions">
                    <Button
                        variant="default"
                        size="small"
                        onClick={handleLogout}
                    >
                        ログアウト
                    </Button>
                </div>
            </header>

            {/* --- ページコンテンツ --- */}
            {/* 子ルート (HomePage, LikedPapersPage など) はここに表示されます */}
            <main className="layout-content">
                <Outlet />
            </main>
        </div>
    );
}