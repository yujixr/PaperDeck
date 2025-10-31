// src/routes/mod.rs
use crate::auth::auth_middleware;
use crate::state::AppState;
use axum::{Router, middleware};
use tower_http::services::{ServeDir, ServeFile};

mod admin;
mod auth;
mod papers;
mod swagger;

/// アプリケーション全体のルーターを構築
pub fn create_router(app_state: AppState, static_dir: String) -> Router {
    // API ルーター
    let api_router = create_api_router(app_state.clone());

    // Swagger UI ルーター
    let swagger_routes = swagger::create_swagger_routes();

    // 静的ファイル配信 (例: "./dist")
    // SPAフォールバック用の index.html のパスを構築します
    let index_html_path = std::path::PathBuf::from(static_dir.clone()).join("index.html");

    // ServeFile サービスはリクエストごとにパスを clone する必要があるため、
    // ここで clone しておきます。
    let index_html_service = ServeFile::new(index_html_path);

    let static_files_service = ServeDir::new(static_dir)
        // 該当ファイルが見つからない場合 (例: /liked への直接アクセス)
        // index.html を返すようにフォールバックさせます (SPA対応)
        .not_found_service(index_html_service);

    // ルーターをマージ
    Router::new()
        .merge(swagger_routes)
        // API全体を "/api" パス以下にネスト
        .nest("/api", api_router)
        // ルートパス "/" は静的ファイル配信（SPA対応のため存在しないファイルはindex.htmlを返す）
        .fallback_service(static_files_service)
        .with_state(app_state)
}

/// 全APIルート（/auth, /papers, /admin）を結合したルーターを構築
fn create_api_router(app_state: AppState) -> Router<AppState> {
    // 認証が不要なルート (ログイン/登録)
    let auth_routes = auth::create_auth_routes();

    // 認証が必要なルート (PaperDeck機能)
    let paper_routes = papers::create_paper_routes().layer(middleware::from_fn_with_state(
        app_state.clone(),
        auth_middleware,
    ));

    // 認証が必要なルート (管理機能)
    let admin_routes = admin::create_admin_routes().layer(middleware::from_fn_with_state(
        app_state.clone(),
        auth_middleware,
    ));

    // 全てのAPIルートをマージ
    Router::new()
        .merge(auth_routes)
        .merge(paper_routes)
        .merge(admin_routes)
}
