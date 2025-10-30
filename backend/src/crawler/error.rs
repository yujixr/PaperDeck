// src/crawler/error.rs
use std::error::Error as StdError;
use std::fmt;

/// クローラーモジュール専用のエラー型
#[derive(Debug)]
pub(super) enum CrawlError {
    Fetch(reqwest::Error),
    Http(String),
    Parse(String),
    Database(sqlx::Error),
    Url(url::ParseError),
    NoParserFound(String),
}

impl fmt::Display for CrawlError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CrawlError::Fetch(e) => write!(f, "Failed to fetch URL: {}", e),
            CrawlError::Http(s) => write!(f, "HTTP error: {}", s),
            CrawlError::Parse(s) => write!(f, "Parsing error: {}", s),
            CrawlError::Database(e) => write!(f, "Database error: {}", e),
            CrawlError::Url(e) => write!(f, "Invalid URL: {}", e),
            CrawlError::NoParserFound(url) => write!(f, "No parser found for URL: {}", url),
        }
    }
}

impl StdError for CrawlError {
    fn source(&self) -> Option<&(dyn StdError + 'static)> {
        match self {
            CrawlError::Fetch(e) => Some(e),
            CrawlError::Database(e) => Some(e),
            CrawlError::Url(e) => Some(e),
            _ => None,
        }
    }
}

// --- 便利な From 実装 ---
impl From<reqwest::Error> for CrawlError {
    fn from(e: reqwest::Error) -> Self {
        CrawlError::Fetch(e)
    }
}
impl From<sqlx::Error> for CrawlError {
    fn from(e: sqlx::Error) -> Self {
        CrawlError::Database(e)
    }
}
impl From<url::ParseError> for CrawlError {
    fn from(e: url::ParseError) -> Self {
        CrawlError::Url(e)
    }
}
impl From<scraper::error::SelectorErrorKind<'_>> for CrawlError {
    fn from(e: scraper::error::SelectorErrorKind) -> Self {
        CrawlError::Parse(e.to_string())
    }
}
