// auth.rs
use argon2::{
    Argon2,
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString, rand_core::OsRng},
};
use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
};
use axum_extra::{
    TypedHeader,
    headers::{Authorization, authorization::Bearer},
};
use chrono::{Duration, Utc};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};
use tracing;

// ユーザー名のバリデーション用 (半角英数字のみ)
static RE_USERNAME: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^[a-zA-Z0-9]+$").expect("Failed to compile username regex"));

// パスワードの最小長
const MIN_PASSWORD_LEN: usize = 8;

// JWTに含めるクレーム (Payload)
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: i64, // Subject (user_id)
    pub exp: i64, // Expiration time
    pub iat: i64, // Issued at
}

// ミドルウェアがハンドラに渡すユーザー情報
// (Extension<AuthUser> として受け取る)
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: i64,
}

// --- JWTキーのグローバル管理 --
#[derive(Clone)]
pub(crate) struct Keys {
    encoding: EncodingKey,
    decoding: DecodingKey,
}

// main.rs で初期化時に呼び出す
impl Keys {
    pub fn new(secret: &[u8]) -> Self {
        Self {
            encoding: EncodingKey::from_secret(secret),
            decoding: DecodingKey::from_secret(secret),
        }
    }
}

/// 認証ミドルウェア
pub async fn auth_middleware(
    State(state): State<crate::state::AppState>,
    TypedHeader(auth_header): TypedHeader<Authorization<Bearer>>,
    mut request: Request<Body>,
    next: Next,
) -> Result<Response, (StatusCode, String)> {
    let token = auth_header.token();

    let validation = Validation::default();

    // トークンをデコード (検証)
    let claims = match decode::<Claims>(token, &state.keys.decoding, &validation) {
        Ok(token_data) => token_data.claims,
        Err(e) => {
            tracing::warn!("Auth failed (invalid token): {}", e);
            return Err((StatusCode::UNAUTHORIZED, "Invalid token".to_string()));
        }
    };

    // 有効期限チェック (Chrono)
    let now = Utc::now().timestamp();
    if claims.exp < now {
        tracing::warn!("Auth failed (token expired) for user: {}", claims.sub);
        return Err((StatusCode::UNAUTHORIZED, "Token has expired".to_string()));
    }

    // DBチェックを追加 (AppState から db_pool を取得)
    let user_exists = sqlx::query("SELECT 1 FROM users WHERE user_id = ?")
        .bind(claims.sub)
        .fetch_optional(&state.db_pool)
        .await
        .map_err(|e| {
            tracing::error!("Database error during auth: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal server error".to_string(),
            )
        })?
        .is_some();

    if !user_exists {
        tracing::warn!("Auth failed (user not found): {}", claims.sub);
        return Err((StatusCode::UNAUTHORIZED, "User does not exist".to_string()));
    }

    // リクエストにユーザー情報を添付 (Extension)
    request.extensions_mut().insert(AuthUser {
        user_id: claims.sub,
    });

    // 次のミドルウェアまたはハンドラを呼び出す
    Ok(next.run(request).await)
}

// --- ヘルパー関数 ---

/// ユーザー登録時のバリデーションを実行します
pub fn validate_registration(username: &str, password: &str) -> Result<(), String> {
    if !RE_USERNAME.is_match(username) {
        tracing::warn!("Failed to register: Invalid username format '{}'", username);
        return Err("Username must be alphanumeric (a-z, A-Z, 0-9).".to_string());
    }

    if password.len() < MIN_PASSWORD_LEN {
        tracing::warn!(
            "Failed to register: Password too short for user '{}'",
            username
        );
        return Err(format!(
            "Password must be at least {} characters long.",
            MIN_PASSWORD_LEN
        ));
    }

    Ok(())
}

/// パスワードハッシュ化 (Argon2)
pub fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(OsRng);
    let argon2 = Argon2::default();

    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)?
        .to_string();

    Ok(password_hash)
}

/// パスワード検証
pub fn verify_password(password: &str, hash: &str) -> bool {
    let parsed_hash = match PasswordHash::new(hash) {
        Ok(hash) => hash,
        Err(_) => return false,
    };

    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok()
}

/// JWT生成
pub fn create_jwt(user_id: i64, keys: &Keys) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let iat = now.timestamp();
    let exp = (now + Duration::days(7)).timestamp(); // 有効期限: 7日後

    let claims = Claims {
        sub: user_id,
        iat,
        exp,
    };

    encode(&Header::default(), &claims, &keys.encoding)
}
