// src/routes/swagger.rs
use utoipa::{
    Modify, OpenApi,
    openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme},
};
use utoipa_swagger_ui::SwaggerUi;

// models.rs から ToSchema を実装した型をすべてインポートする
use crate::models::{
    AuthToken, Conference, CrawlPayload, CrawlResponse, LoginPayload, Paper, PaperStatus,
    RegisterPayload, StatusPayload, User,
};

// --- APIドキュメントの定義 ---

#[derive(OpenApi)]
#[openapi(
    paths(
        crate::routes::admin::trigger_crawl,
        crate::routes::auth::register,
        crate::routes::auth::login,
        crate::routes::papers::get_conferences,
        crate::routes::papers::get_liked_papers,
        crate::routes::papers::get_next_paper,
        crate::routes::papers::set_paper_status,
    ),
    components(
        schemas(
            // src/models.rs で ToSchema を derive した型
            Paper, User, RegisterPayload, LoginPayload, AuthToken,
            StatusPayload, CrawlPayload, PaperStatus, CrawlResponse, Conference
        )
    ),
    tags(
        (name = "PaperDeck API", description = "論文アブストラクト閲覧・仕分けAPI")
    ),
    modifiers(&SecurityAddon) // Bearer 認証の定義
)]
struct ApiDoc;

// --- 認証 (Bearer) の定義 ---

struct SecurityAddon;
impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        let components = openapi.components.get_or_insert_with(Default::default);
        components.add_security_scheme(
            "bearer_auth", // この名前は #[utoipa::path(...)] で参照します
            SecurityScheme::Http(
                HttpBuilder::new()
                    .scheme(HttpAuthScheme::Bearer)
                    .bearer_format("JWT")
                    .build(),
            ),
        );
    }
}

// --- ルーターの構築 ---

/// Swagger UI をホストするルーターを返します。
/// ( /api-docs にUI、 /api-docs/openapi.json に仕様JSON)
pub fn create_swagger_routes() -> SwaggerUi {
    SwaggerUi::new("/api-docs").url("/api-docs/openapi.json", ApiDoc::openapi())
}
