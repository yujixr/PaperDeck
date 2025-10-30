// src/routes/auth.rs
use axum::{Json, Router, extract::State, http::StatusCode, routing::post};
use tracing;

use crate::auth::{create_jwt, hash_password, verify_password, validate_registration};
use crate::models::{AuthToken, LoginPayload, RegisterPayload, User};
use crate::state::AppState;

/// 認証ルート (/auth/...) を構築します
pub fn create_auth_routes() -> Router<AppState> {
    Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
}

/// ユーザー登録 (POST /auth/register)
#[utoipa::path(
    post,
    path = "/api/auth/register",
    tag = "Auth", // Swagger UI での分類タグ
    request_body(
        content = RegisterPayload,
        description = "ユーザー名とパスワード",
        example = json!({
            "username": "testuser",
            "password": "password123"
        })
    ),
    responses(
        (
            status = 200,
            description = "登録成功",
            body = User,
            example = json!({
                "user_id": 1,
                "username": "testuser",
            })
        ),
        (
            status = 400,
            description = "入力されたユーザ名/パスワードが要件を満たさない",
            body = String,
            example = json!("Username must be alphanumeric (a-z, A-Z, 0-9).")
        ),
        (
            status = 409,
            description = "ユーザー名が既に使用されている",
            body = String,
            example = json!("Username already taken")
        ),
        (status = 500, description = "サーバーエラー")
    )
)]
async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterPayload>,
) -> Result<Json<User>, (StatusCode, String)> {
    // 1. ユーザー名とパスワードのバリデーション
    if let Err(msg) = validate_registration(&payload.username, &payload.password) {
        // エラーメッセージをそのまま返す
        return Err((StatusCode::BAD_REQUEST, msg));
    }

    // 2. パスワードをハッシュ化 (ブロッキングタスクとして実行)
    // spawn_blocking のクロージャに渡すため、パスワードをクロージャに move する
    let password = payload.password;
    let password_hash = tokio::task::spawn_blocking(move || hash_password(&password))
        .await
        .map_err(|e| {
            // タスクの JoinError (例: パニック)
            tracing::error!("spawn_blocking failed for hash_password: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal server error".to_string(),
            )
        })? // -> Result<String, argon2::Error>
        .map_err(|e| {
            // Argon2 のハッシュ化自体のエラー
            tracing::error!("Failed to hash password: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to hash password".to_string(),
            )
        })?; // -> String

    // 3. ユーザーをDBに挿入
    let result = sqlx::query("INSERT INTO users (username, password_hash) VALUES (?, ?)")
        .bind(&payload.username)
        .bind(&password_hash)
        .execute(&state.db_pool)
        .await;

    match result {
        Ok(db_result) => {
            let user_id = db_result.last_insert_rowid();
            let user = User {
                user_id,
                username: payload.username.clone(),
                password_hash,
            };
            tracing::info!("New user registered: {}", user.username);
            Ok(Json(user))
        }
        Err(e) => {
            // sqlx::Error をダウンキャストして、DB固有のエラーか確認
            if let Some(db_err) = e.as_database_error() {
                // is_unique_violation() メソッドで一意制約違反かを判定
                if db_err.is_unique_violation() {
                    tracing::warn!(
                        "Failed to register user (username taken): {}",
                        payload.username
                    );
                    return Err((
                        StatusCode::CONFLICT, // 409 Conflict
                        "Username already taken".to_string(),
                    ));
                }
            }

            // その他のDBエラー、またはDB以外のエラー
            tracing::error!("Failed to register user {}: {}", payload.username, e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to register user".to_string(),
            ))
        }
    }
}

/// ログイン (POST /auth/login)
#[utoipa::path(
    post,
    path = "/api/auth/login",
    tag = "Auth",
    request_body(
        content = LoginPayload,
        description = "ユーザー名とパスワード",
        example = json!({
            "username": "testuser",
            "password": "password123"
        })
    ),
    responses(
        (
            status = 200,
            description = "ログイン成功",
            body = AuthToken,
            example = json!({
                "token": "ey...（JWTトークン）...",
                "token_type": "Bearer"
            })
        ),
        (
            status = 401, 
            description = "認証情報が無効", 
            body = String, 
            example = json!("Incorrect username or password")
        ),
        (status = 500, description = "サーバーエラー")
    )
)]
async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginPayload>,
) -> Result<Json<AuthToken>, (StatusCode, String)> {
    // 1. ユーザー名でDBを検索
    let user = match sqlx::query_as::<_, User>(
        "SELECT user_id, username, password_hash FROM users WHERE username = ?",
    )
    .bind(&payload.username)
    .fetch_optional(&state.db_pool)
    .await
    {
        Ok(Some(user)) => user,
        Ok(None) => {
            tracing::warn!("Login failed (user not found): {}", payload.username);
            return Err((
                StatusCode::UNAUTHORIZED,
                "Incorrect username or password".to_string(),
            ));
        }
        Err(e) => {
            tracing::error!(
                "Database error during login for {}: {}",
                payload.username,
                e
            );
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Database error: {}", e),
            ));
        }
    };

    // 2. パスワードハッシュを検証 (ブロッキングタスクとして実行)
    let password = payload.password; // クロージャに move するため
    let password_hash = user.password_hash.clone(); // 同上
    let username_for_log = user.username.clone(); // ログ用

    let is_valid = tokio::task::spawn_blocking(move || verify_password(&password, &password_hash))
        .await
        .map_err(|e| {
            // タスクの JoinError (例: パニック)
            tracing::error!("spawn_blocking failed for verify_password: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal server error".to_string(),
            )
        })?; // -> bool

    if !is_valid {
        tracing::warn!("Login failed (invalid password): {}", username_for_log);
        return Err((
            StatusCode::UNAUTHORIZED,
            "Incorrect username or password".to_string(),
        ));
    }

    // 3. JWTを生成 (authモジュールから呼び出し)
    let token = match create_jwt(user.user_id, &state.keys) {
        Ok(token) => token,
        Err(e) => {
            tracing::error!("Failed to generate JWT for user {}: {}", user.user_id, e);
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to generate token".to_string(),
            ));
        }
    };

    tracing::info!("User logged in: {}", user.username);
    Ok(Json(AuthToken {
        token,
        token_type: "Bearer".to_string(),
    }))
}
