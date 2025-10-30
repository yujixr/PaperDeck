// api/src/crawler/mod.rs

mod error;
mod parser_usenix;

use error::CrawlError;
use parser_usenix::UsenixParser;

use sqlx::{Sqlite, SqlitePool, Transaction};
use tracing;
use url::Url;

/// 抽出した論文情報を保持する構造体 (DB挿入用)
// (parser_usenix.rs からも参照されるため、pub(super) または pub にする)
#[derive(Debug, Clone)]
pub(super) struct Paper {
    conference_name: String,
    year: i32,
    title: String,
    url: String,
    authors: String,
    abstract_text: String,
}

/// すべてのWebサイト固有パーサーのための共通トレイト
trait PaperParser
where
    Self: Send,
{
    /// HTMLコンテンツをパースし、論文情報のリストを抽出する
    fn parse_and_extract(
        &self,
        html_content: &str,
        url_str: &str,
    ) -> Result<Vec<Paper>, CrawlError>;
}

/// URLのホスト名に基づいて適切なパーサーを選択する
fn get_parser(url_str: &str) -> Result<Box<dyn PaperParser>, CrawlError> {
    // url クレートを使い、URLを安全にパース
    let url = Url::parse(url_str)?;
    let host = url.host_str().unwrap_or_default();

    if host.contains("usenix.org") {
        tracing::debug!("Using UsenixParser for: {}", url_str);
        Ok(Box::new(UsenixParser))
    } else {
        // TODO: 将来的に他のパーサーを追加 (例: acm.org, ieee.org)
        // } else if host.contains("acm.org") {
        //     Ok(Box::new(AcmParser))
        // }
        tracing::warn!("No parser found for host: {}", host);
        Err(CrawlError::NoParserFound(url_str.to_string()))
    }
}

// --- データベースロジック ---
/// 論文データのスライスをデータベースに挿入する (重複は無視)
async fn insert_papers(
    tx: &mut Transaction<'_, Sqlite>,
    papers: &[Paper],
) -> Result<usize, sqlx::Error> {
    let mut inserted_count = 0;

    for paper in papers {
        let result = sqlx::query(
            "INSERT OR IGNORE INTO papers (conference_name, year, title, url, authors, abstract_text)
            VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(&paper.conference_name)
        .bind(paper.year)
        .bind(&paper.title)
        .bind(&paper.url)
        .bind(&paper.authors)
        .bind(&paper.abstract_text)
        .execute(&mut **tx)
        .await?;

        if result.rows_affected() > 0 {
            inserted_count += 1;
        }
    }
    Ok(inserted_count)
}

// --- HTMLフェッチロジック ---
/// 指定されたURLからHTMLコンテンツを非同期で取得する
async fn fetch_html(url: &str) -> Result<String, CrawlError> {
    tracing::info!("Fetching HTML from: {}", url);
    let client = reqwest::Client::new();
    let response = client.get(url).send().await?;

    if !response.status().is_success() {
        let status = response.status();
        tracing::error!("Failed to fetch URL {}: {}", url, status);
        return Err(CrawlError::Http(format!(
            "HTTP Error for {}: {}",
            url, status
        )));
    }
    let html_content = response.text().await?;
    tracing::info!("Successfully fetched HTML from: {}", url);
    Ok(html_content)
}

// --- 実行の起点となる関数 ---

/// クローリングのコアロジック (内部関数)
/// エラーが発生しても（DBエラー以外）、次のURLの処理を続行します。
async fn run_crawl_logic(
    db_pool: &SqlitePool,
    urls: Vec<String>,
) -> Result<(usize, usize), CrawlError> {
    let mut total_papers_inserted = 0;
    let mut total_papers_found = 0;

    let mut tx = db_pool.begin().await?;

    for url_str in &urls {
        // 1. URLに基づいてパーサーを動的に選択
        let parser = match get_parser(url_str) {
            Ok(p) => p,
            Err(e) => {
                // パーサーが見つからない場合はエラーをログに記録し、次のURLへ
                tracing::error!("Skipping URL: {}", e);
                continue; // ループの次のイテレーションへ
            }
        };

        // 1つのURLのフェッチやパースに失敗しても、ループを継続する
        // 2. HTMLのフェッチ
        match fetch_html(url_str).await {
            Ok(html_content) => {
                // 3. 選択されたパーサーでパース
                match parser.parse_and_extract(&html_content, url_str) {
                    Ok(papers) => {
                        let num_found = papers.len();
                        total_papers_found += num_found;

                        if num_found > 0 {
                            // 4. DB挿入
                            match insert_papers(&mut tx, &papers).await {
                                Ok(inserted) => {
                                    total_papers_inserted += inserted;
                                    tracing::info!(
                                        "Inserted {} new papers from {}",
                                        inserted,
                                        url_str
                                    );
                                }
                                Err(db_err) => {
                                    tracing::error!(
                                        "Database insertion error for {}: {}. Rolling back.",
                                        url_str,
                                        db_err
                                    );
                                    let _ = tx.rollback().await; // ロールバックを試みる
                                    return Err(db_err.into());
                                }
                            }
                        }
                    }
                    Err(parse_err) => {
                        tracing::error!("Error parsing/extracting from {}: {}", url_str, parse_err);
                    }
                }
            }
            Err(fetch_err) => {
                tracing::error!("Error fetching URL {}: {}", url_str, fetch_err);
            }
        }
    }

    // すべて成功したらコミット
    tx.commit().await?;

    Ok((total_papers_found, total_papers_inserted))
}

/// クローリングを実行し、DBプールにデータを挿入します (公開API)
pub async fn run_crawl(db_pool: &SqlitePool, urls: Vec<String>) -> Result<String, String> {
    match run_crawl_logic(db_pool, urls).await {
        Ok((total_papers_found, total_papers_inserted)) => {
            let summary = format!(
                "Crawl complete. Total papers found: {}. Total new papers inserted: {}",
                total_papers_found, total_papers_inserted
            );
            tracing::info!("{}", summary);
            Ok(summary)
        }
        Err(e) => {
            // APIハンドラが `String` のエラーを期待しているため、ここで変換する
            tracing::error!("Crawl failed: {}", e);
            Err(e.to_string())
        }
    }
}
