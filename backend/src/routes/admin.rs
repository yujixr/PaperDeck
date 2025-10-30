// api/src/routes/admin.rs
use axum::{Json, Router, extract::State, http::StatusCode, response::IntoResponse, routing::post};
use tokio;
use tracing;

use crate::state::AppState;
// AuthUser を Extension で受け取れるようにする
// (AuthUser は `auth.rs` で pub になっている必要があります)
use crate::auth::AuthUser;
use axum::Extension;

use crate::models::{CrawlPayload, CrawlResponse};

/// 管理用ルート (/admin/...) を構築します
pub fn create_admin_routes() -> Router<AppState> {
    Router::new().route("/admin/trigger_crawl", post(trigger_crawl))
}

/// クローリングをバックグラウンドで実行する (POST /admin/trigger_crawl)
#[utoipa::path(
    post,
    path = "/api/admin/trigger_crawl",
    tag = "Admin",
    request_body(
        content = CrawlPayload,
        description = "URLリスト",
        example = json!({
            "urls": [
                "https://www.usenix.org/conference/usenixsecurity25/technical-sessions",
                "https://www.usenix.org/conference/usenixsecurity24/technical-sessions"
            ]
        })
    ),
    responses(
        (
            status = 202,
            description = "クローリング開始",
            body = CrawlResponse,
            example = json!({"message": "Crawl started in background."})
        ),
        (status = 500, description = "サーバーエラー")
    ),
    security(("bearer_auth" = [])) // Bearer 認証を要求
)]
async fn trigger_crawl(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    // JSONペイロードを受け取る
    Json(payload): Json<CrawlPayload>,
) -> impl IntoResponse {
    tracing::info!("Crawl triggered by user_id: {}", auth_user.user_id);

    // クローリングは時間がかかるため、HTTPリクエストをブロックしないよう
    // `tokio::spawn` を使ってバックグラウンドタスクとして実行します。
    // DBプール (AppState) は `Clone` 可能です。
    let db_pool = state.db_pool.clone();

    // ペイロードからURLリストを取得
    let urls_to_crawl = payload.urls;

    tokio::spawn(async move {
        tracing::info!("Background crawl task started...");
        // クローラー関数にURLリストを渡す
        match crate::crawler::run_crawl(&db_pool, urls_to_crawl).await {
            Ok(summary) => {
                tracing::info!("Background crawl finished: {}", summary);
            }
            Err(e) => {
                tracing::error!("Background crawl failed: {}", e);
            }
        }
    });

    // リクエストにはすぐに「受け付けた」というレスポンスを返します
    (
        StatusCode::ACCEPTED,
        Json(CrawlResponse {
            message: "Crawl started in background.".to_string(),
        }),
    )
}
