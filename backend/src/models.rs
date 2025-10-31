// models.rs
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// 1. PaperStatus Enum (DBとJSON用)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, sqlx::Type, ToSchema)]
#[sqlx(type_name = "paper_status_enum", rename_all = "PascalCase")]
#[serde(rename_all = "PascalCase")]
pub enum PaperStatus {
    Liked,
    Read,
}

// 2. Paper 構造体 (DBからの読み取り用)
#[derive(Debug, Serialize, sqlx::FromRow, ToSchema)]
pub struct Paper {
    pub id: i64,
    pub conference_name: String,
    pub year: i64,
    pub title: String,
    pub url: Option<String>,
    pub authors: Option<String>,
    pub abstract_text: Option<String>,
}

// フィルター用の学会・年度リスト
#[derive(Debug, Serialize, sqlx::FromRow, ToSchema)]
pub struct Conference {
    pub name: String,
    pub year: i64,
}

// 3. POSTリクエスト用のペイロード
#[derive(Debug, Deserialize, ToSchema)]
pub struct StatusPayload {
    pub status: PaperStatus,
}

// DBから読み取る User 構造体
#[derive(Debug, Serialize, sqlx::FromRow, ToSchema)]
pub struct User {
    pub user_id: i64,
    pub username: String,
    #[serde(skip)] // パスワードハッシュはAPIで返さない
    #[schema(hidden = true)] // Utoipa スキーマからも除外
    pub password_hash: String,
}

// ユーザー登録 (POST /auth/register) のペイロード
#[derive(Debug, Deserialize, ToSchema)]
pub struct RegisterPayload {
    pub username: String,
    pub password: String, // 生パスワード
}

// ログイン (POST /auth/login) のペイロード
#[derive(Debug, Deserialize, ToSchema)]
pub struct LoginPayload {
    pub username: String,
    pub password: String, // 生パスワード
}

// ログイン成功時に返すトークン
#[derive(Debug, Serialize, ToSchema)]
pub struct AuthToken {
    pub token: String,
    pub token_type: String, // "Bearer"
}

// クローリング (POST /admin/trigger_crawl) のペイロード
#[derive(Debug, Deserialize, ToSchema)]
pub struct CrawlPayload {
    pub urls: Vec<String>,
}

// クローリング (POST /admin/trigger_crawl) のレスポンス
#[derive(Debug, Serialize, ToSchema)]
pub struct CrawlResponse {
    pub message: String,
}

// 論文取得 (GET /papers/next) のクエリパラメータ
#[derive(Debug, Deserialize)]
pub struct NextPaperParams {
    pub conference: Option<String>,
    pub year: Option<i64>,
}
