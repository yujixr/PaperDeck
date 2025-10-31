// src/routes/papers.rs
use crate::auth::AuthUser;
use crate::models::{Conference, NextPaperParams, Paper, PaperStatus, StatusPayload};
use crate::state::AppState;
use axum::{
    Extension, Json, Router,
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, post},
};
use chrono::Utc;
use sqlx::{QueryBuilder, Sqlite};
use tracing;

/// 論文APIルート (/papers/...) を構築します
pub fn create_paper_routes() -> Router<AppState> {
    Router::new()
        .route("/papers/conferences", get(get_conferences))
        .route("/papers/liked", get(get_liked_papers))
        .route("/papers/next", get(get_next_paper))
        .route("/papers/:paper_id/status", post(set_paper_status))
}

/// 登録されている学会名と年度のリストを取得 (GET /papers/conferences)
#[utoipa::path(
    get,
    path = "/api/papers/conferences",
    tag = "Papers",
    responses(
        (
            status = 200,
            description = "学会と年度のユニークな組み合わせリスト",
            body = Vec<Conference>,
            example = json!([
                {"name": "USENIX Security", "year": 2025},
                {"name": "USENIX Security", "year": 2024}
            ])
        ),
        (status = 500, description = "サーバーエラー")
    ),
    security(("bearer_auth" = [])) // 認証が必要
)]
async fn get_conferences(
    State(state): State<AppState>,
    Extension(_auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<Conference>>, (StatusCode, String)> {
    let result = sqlx::query_as::<_, Conference>(
        r#"
        SELECT DISTINCT
            conference_name AS name,
            year
        FROM papers
        ORDER BY year DESC, name ASC
        "#,
    )
    .fetch_all(&state.db_pool)
    .await;

    match result {
        Ok(metadata) => Ok(Json(metadata)),
        Err(e) => {
            tracing::error!("Database error in get_conferences: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Database error: {}", e),
            ))
        }
    }
}

/// いいねした論文のリストを取得 (GET /papers/liked)
#[utoipa::path(
    get,
    path = "/api/papers/liked",
    tag = "Papers",
    responses(
        (
            status = 200,
            description = "いいねした論文のリストを取得",
            body = Vec<Paper>,
            example = json!([{
                "id": 123,
                "conference_name": "ICLR",
                "year": 2024,
                "title": "A paper about models",
                "url": "http://example.com",
                "authors": "A. Author, B. Author",
                "abstract_text": "This abstract is about..."
            }])
        ),
        (status = 500, description = "サーバーエラー")
    ),
    security(("bearer_auth" = []))
)]
async fn get_liked_papers(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<Paper>>, (StatusCode, String)> {
    let current_user_id = auth_user.user_id;

    let result = sqlx::query_as::<_, Paper>(
        r#"
        SELECT p.*
        FROM papers p
        JOIN user_paper_status ups ON p.id = ups.paper_id
        WHERE ups.user_id = ? AND ups.liked_at IS NOT NULL
        ORDER BY ups.liked_at DESC
        "#,
    )
    .bind(current_user_id)
    .fetch_all(&state.db_pool)
    .await;

    match result {
        Ok(papers) => Ok(Json(papers)),
        Err(e) => {
            tracing::error!(
                "Database error in get_liked_papers for user {}: {}",
                current_user_id,
                e
            );
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Database error: {}", e),
            ))
        }
    }
}

/// 次に評価すべき論文をランダムに1件取得 (GET /papers/next)
#[utoipa::path(
    get,
    path = "/api/papers/next",
    tag = "Papers",
    params(
        ("conference" = Option<String>, Query, description = "学会名", example = "USENIX Security"),
        ("year" = Option<i64>, Query, description = "年度", example = 2025)
    ),
    responses(
        (
            status = 200,
            description = "未評価の論文を1件取得",
            body = Paper,
            example = json!({
                "id": 123,
                "conference_name": "ICLR",
                "year": 2024,
                "title": "A paper about models",
                "url": "http://example.com",
                "authors": "A. Author, B. Author",
                "abstract_text": "This abstract is about..."
            })
        ),
        (
            status = 404,
            description = "未評価の論文がない",
            body = String,
            example = json!("No unrated papers found")
        ),
        (status = 500, description = "サーバーエラー")
    ),
    security(("bearer_auth" = []))
)]
async fn get_next_paper(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Query(params): Query<NextPaperParams>,
) -> Result<Json<Paper>, (StatusCode, String)> {
    let current_user_id = auth_user.user_id;

    // QueryBuilder を使って動的にクエリを構築
    let mut query_builder: QueryBuilder<Sqlite> = QueryBuilder::new(
        r#"
        SELECT p.*
        FROM papers p
        LEFT JOIN user_paper_status ups 
            ON p.id = ups.paper_id AND ups.user_id = 
        "#,
    );
    query_builder.push_bind(current_user_id);

    // 残りの WHERE 句を追加
    query_builder.push(" WHERE ups.created_at IS NULL ");

    // conference パラメータが存在し、空文字列でない場合
    if let Some(conf_name) = &params.conference {
        if !conf_name.is_empty() {
            query_builder.push(" AND p.conference_name = ");
            query_builder.push_bind(conf_name);
        }
    }

    // year パラメータが存在する場合
    if let Some(year) = params.year {
        query_builder.push(" AND p.year = ");
        query_builder.push_bind(year);
    }

    // 最後にランダムソートとリミットを追加
    query_builder.push(" ORDER BY RANDOM() LIMIT 1");

    let result = query_builder
        .build_query_as::<Paper>()
        .fetch_optional(&state.db_pool)
        .await;

    match result {
        // --- 成功ケース ---
        Ok(Some(paper)) => Ok(Json(paper)),

        // --- 失敗ケース (DBエラー) ---
        Err(e) => {
            tracing::error!(
                "Database error in get_next_paper for user {}: {}",
                current_user_id,
                e
            );
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Database error: {}", e),
            ))
        }

        // --- 見つからないケース (404) ---
        Ok(None) => {
            // フィルタに一致する論文がそもそも存在するかを確認する
            let mut check_query: QueryBuilder<Sqlite> =
                QueryBuilder::new("SELECT 1 FROM papers WHERE 1=1 ");

            if let Some(conf_name) = &params.conference {
                if !conf_name.is_empty() {
                    check_query.push(" AND conference_name = ");
                    check_query.push_bind(conf_name);
                }
            }
            if let Some(year) = params.year {
                check_query.push(" AND year = ");
                check_query.push_bind(year);
            }
            check_query.push(" LIMIT 1");

            let check_result = check_query.build().fetch_optional(&state.db_pool).await;

            match check_result {
                Ok(Some(_)) => {
                    // ケースA: 論文は存在するが、すべて評価済み
                    tracing::info!(
                        "No unrated papers found for user {} (all rated for filters: {:?})",
                        current_user_id,
                        params
                    );
                    Err((
                        StatusCode::NOT_FOUND,
                        "All papers matching these filters have been rated.".to_string(),
                    ))
                }
                Ok(None) => {
                    // ケースB: フィルタに合う論文が1件も存在しない
                    tracing::info!("No papers found at all for filters: {:?}", params);
                    Err((
                        StatusCode::NOT_FOUND,
                        "No papers found matching the specified filters.".to_string(),
                    ))
                }
                Err(e) => {
                    // 追加クエリ自体がエラー
                    tracing::error!("Database error (check query) in get_next_paper: {}", e);
                    Err((
                        StatusCode::INTERNAL_SERVER_ERROR,
                        format!("Database check error: {}", e),
                    ))
                }
            }
        }
    }
}

/// 論文の評価ステータスを設定 (POST /papers/:paper_id/status)
#[utoipa::path(
    post,
    path = "/api/papers/{paper_id}/status",
    tag = "Papers",
    params(
        ("paper_id" = i64, Path, description = "論文ID", example = 123)
    ),
    request_body(
        content = StatusPayload,
        description = "評価ステータス (Liked/Read)",
        example = json!({
            "status": "Liked"
        })
    ),
    responses(
        (status = 201, description = "ステータス更新成功"),
        (status = 500, description = "サーバーエラー")
    ),
    security(("bearer_auth" = []))
)]
async fn set_paper_status(
    State(state): State<AppState>,
    Path(paper_id): Path<i64>,
    Extension(auth_user): Extension<AuthUser>,
    Json(payload): Json<StatusPayload>,
) -> Result<StatusCode, (StatusCode, String)> {
    let current_user_id = auth_user.user_id;

    let query = match payload.status {
        PaperStatus::Liked => {
            let now = Utc::now().to_rfc3339();
            sqlx::query(
                r#"
                INSERT INTO user_paper_status (user_id, paper_id, liked_at)
                VALUES (?, ?, ?)
                ON CONFLICT(user_id, paper_id) DO UPDATE SET
                    liked_at = excluded.liked_at,
                    created_at = user_paper_status.created_at
                "#,
            )
            .bind(current_user_id)
            .bind(paper_id)
            .bind(now)
        }
        PaperStatus::Read => sqlx::query(
            r#"
            INSERT INTO user_paper_status (user_id, paper_id, liked_at)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id, paper_id) DO NOTHING;
            "#,
        )
        .bind(current_user_id)
        .bind(paper_id)
        .bind(None::<String>),
    };

    let result = query.execute(&state.db_pool).await;

    match result {
        Ok(_) => {
            tracing::info!(
                "User {} set status for paper {}: {}",
                current_user_id,
                paper_id,
                match payload.status {
                    PaperStatus::Liked => "Liked",
                    PaperStatus::Read => "Read",
                }
            );
            Ok(StatusCode::CREATED)
        }
        Err(e) => {
            tracing::error!(
                "Database error in set_paper_status for user {}: {}",
                current_user_id,
                e
            );
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Database error: {}", e),
            ))
        }
    }
}
