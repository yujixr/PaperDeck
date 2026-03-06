import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { SettingsDialog } from "./SettingsDialog";
import "./Layout.css";

function useViewTransitionNavigate() {
  const navigate = useNavigate();
  return (to: string) => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => void };
    if (!doc.startViewTransition) {
      navigate(to);
      return;
    }
    doc.startViewTransition(() => navigate(to));
  };
}

export function Layout() {
  const vtNavigate = useViewTransitionNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { key } = useLocation();
  const prevKeyRef = useRef(key);

  // Close menu on route change
  if (prevKeyRef.current !== key) {
    prevKeyRef.current = key;
    if (menuOpen) {
      setMenuOpen(false);
    }
  }

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [menuOpen]);

  return (
    <div className="app-layout">
      <header className="navbar" ref={menuRef}>
        <div className="nav-brand">
          <NavLink
            to="/"
            onClick={(e) => {
              e.preventDefault();
              vtNavigate("/");
            }}
          >
            PaperDeck
          </NavLink>
        </div>
        <nav className={`nav-links${menuOpen ? " nav-links--open" : ""}`}>
          <NavLink
            to="/"
            end
            onClick={(e) => {
              e.preventDefault();
              vtNavigate("/");
            }}
          >
            ホーム
          </NavLink>
          <NavLink
            to="/liked"
            onClick={(e) => {
              e.preventDefault();
              vtNavigate("/liked");
            }}
          >
            いいね一覧
          </NavLink>
          <SettingsDialog trigger="設定" />
        </nav>
        <div className="nav-actions">
          <SettingsDialog />
        </div>
        <button
          type="button"
          className="nav-hamburger"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="メニュー"
          aria-expanded={menuOpen}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </header>
      <main className="layout-content">
        <Outlet />
      </main>
    </div>
  );
}
