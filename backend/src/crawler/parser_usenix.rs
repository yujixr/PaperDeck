// src/crawler/parser_usenix.rs
use super::{CrawlError, Paper, PaperParser};
use chrono::{Datelike, Utc};
use once_cell::sync::Lazy;
use regex::Regex;
use scraper::{Html, Selector};
use tracing;
use url::Url;

// --- USENIXパーサー ---

/// USENIXのセレクタを保持する構造体
struct UsenixSelectors {
    paper_article: Selector,
    paper_title_link: Selector,
    authors: Selector,
    abstract_div: Selector,
    abstract_p: Selector,
    page_title: Selector,
}

/// セレクタとRegexを起動時に一度だけパースする
static SELECTORS: Lazy<UsenixSelectors> = Lazy::new(|| UsenixSelectors {
    paper_article: Selector::parse("article.node-paper")
        .expect("Failed to parse paper article selector"),
    paper_title_link: Selector::parse("h2 a").expect("Failed to parse paper title link selector"),
    authors: Selector::parse(
        "div.field-name-field-paper-people-text p, div.field-name-field-presented-by p",
    )
    .expect("Failed to parse authors selector"),
    abstract_div: Selector::parse("div.field-name-field-paper-description-long")
        .expect("Failed to parse abstract div selector"),
    abstract_p: Selector::parse("p").expect("Failed to parse abstract p selector"),
    page_title: Selector::parse("head > title").expect("Failed to parse title selector"),
});

static RE_CONF: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^(.*?)\s+'?(\d{2})").expect("Failed to compile conference regex"));

pub(super) struct UsenixParser;

impl PaperParser for UsenixParser {
    fn parse_and_extract(
        &self,
        html_content: &str,
        url_str: &str,
    ) -> Result<Vec<Paper>, CrawlError> {
        let document = Html::parse_document(html_content);
        let base_url = Url::parse(url_str)?;

        let page_title = UsenixParser::extract_page_title(&document)?;
        let (conference_name, year) = UsenixParser::extract_conference_info(&page_title);

        tracing::info!(
            "Processing (USENIX): Conf={}, Year={}",
            conference_name,
            year
        );

        UsenixParser::extract_papers(&document, &conference_name, year, &base_url)
    }
}

impl UsenixParser {
    fn extract_page_title(document: &Html) -> Result<String, CrawlError> {
        document
            .select(&SELECTORS.page_title)
            .next()
            .map(|element| element.text().collect::<String>().trim().to_string())
            .ok_or_else(|| CrawlError::Parse("Overall page title not found".to_string()))
    }

    fn extract_conference_info(page_title: &str) -> (String, i32) {
        let current_year = Utc::now().year();

        if let Some(caps) = RE_CONF.captures(page_title) {
            let name = caps.get(1).map_or("", |m| m.as_str()).trim().to_string();
            let year_short = caps
                .get(2)
                .map_or(0, |m| m.as_str().parse::<i32>().unwrap_or(0));
            let full_year = 2000 + year_short;
            (name, full_year)
        } else {
            (
                page_title
                    .split('|')
                    .next()
                    .unwrap_or("Unknown USENIX Conference")
                    .trim()
                    .to_string(),
                current_year,
            )
        }
    }

    fn extract_papers(
        document: &Html,
        conference_name: &str,
        year: i32,
        base_url: &Url,
    ) -> Result<Vec<Paper>, CrawlError> {
        let mut papers = Vec::new();

        for article_element in document.select(&SELECTORS.paper_article) {
            let mut title = "Paper title not found".to_string();
            let mut paper_url = "Paper URL not found".to_string();

            if let Some(title_link_el) = article_element.select(&SELECTORS.paper_title_link).next()
            {
                title = title_link_el.text().collect::<String>().trim().to_string();
                if let Some(href) = title_link_el.value().attr("href") {
                    match base_url.join(href) {
                        Ok(full_url) => paper_url = full_url.to_string(),
                        Err(e) => {
                            paper_url = format!(
                                "Failed to join URL: {} with base {}: {}",
                                href, base_url, e
                            );
                            tracing::warn!("{}", paper_url);
                        }
                    }
                }
            }

            let authors = article_element
                .select(&SELECTORS.authors)
                .next()
                .map(|authors_el| authors_el.text().collect::<String>().trim().to_string())
                .unwrap_or_else(|| "Authors not found".to_string());

            let abstract_text = article_element
                .select(&SELECTORS.abstract_div)
                .next()
                .map(|abstract_div| {
                    abstract_div
                        .select(&SELECTORS.abstract_p)
                        .map(|p| p.text().collect::<String>())
                        .collect::<Vec<String>>()
                        .join("\n")
                        .trim()
                        .to_string()
                })
                .filter(|s| !s.is_empty()) // 空の abstract を "Abstract not found" にする
                .unwrap_or_else(|| "Abstract not found".to_string());

            papers.push(Paper {
                conference_name: conference_name.to_string(),
                year,
                title,
                url: paper_url,
                authors,
                abstract_text,
            });
        }

        if papers.is_empty() {
            tracing::warn!(
                "No papers found in the USENIX document for {} {}.",
                conference_name,
                year
            );
        }

        Ok(papers)
    }
}
