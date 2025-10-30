// state.rs
use crate::auth::Keys;
use sqlx::{Pool, Sqlite};

#[derive(Clone)]
pub struct AppState {
    pub db_pool: Pool<Sqlite>,
    pub keys: Keys,
}
