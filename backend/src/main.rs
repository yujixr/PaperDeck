// main.rs
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::{net::SocketAddr, str::FromStr};
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{EnvFilter, fmt};

mod auth;
mod crawler;
mod models;
mod routes;
mod state;

use crate::auth::Keys;
use state::AppState;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    fmt::Subscriber::builder().with_env_filter(filter).init();

    let db_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:./papers.sqlite".to_string());
    let connect_options = SqliteConnectOptions::from_str(&db_url)?.create_if_missing(true);
    tracing::info!("Connecting to database: {}", db_url);

    let db_pool = SqlitePoolOptions::new()
        .connect_with(connect_options)
        .await?;

    sqlx::migrate!("./migrations").run(&db_pool).await?;

    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "a_very_secret_and_long_key_please_change_me".to_string());
    let keys = Keys::new(jwt_secret.as_bytes());
    let app_state = AppState { db_pool, keys };

    let static_dir = std::env::var("STATIC_DIR").unwrap_or_else(|_| "../frontend/dist".to_string());
    tracing::info!("Serving static files from: {}", static_dir);

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = routes::create_router(app_state, static_dir).layer(cors);

    // サーバーの起動
    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr_str = format!("0.0.0.0:{}", port);
    let addr: SocketAddr = addr_str.parse().expect("Failed to parse address and port");
    tracing::info!("🚀 Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
