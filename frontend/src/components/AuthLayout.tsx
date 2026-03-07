import type { ReactNode } from "react";
import "./AuthForm.css";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <div className="auth-branding">
        <div className="auth-branding-content">
          <p className="auth-branding-tagline">研究への出会いを、もっと手軽に</p>
          <h1 className="auth-branding-title">PaperDeck</h1>
          <ul className="auth-branding-features">
            <li>カードをめくって、論文を次々とチェック</li>
            <li>気になる論文はいいねしてストック</li>
          </ul>
        </div>
      </div>
      <div className="auth-form-panel">{children}</div>
    </div>
  );
}
