-- Add migration 'Up' below
CREATE TABLE IF NOT EXISTS papers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conference_name TEXT NOT NULL,
    year INTEGER NOT NULL,
    title TEXT NOT NULL UNIQUE,
    url TEXT,
    authors TEXT,
    abstract_text TEXT
);

CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL -- 認証を実装するならパスワードハッシュが必要
);

CREATE TABLE IF NOT EXISTS user_paper_status (
    user_id INTEGER NOT NULL,
    paper_id INTEGER NOT NULL,
    liked_at DATETIME,
    -- レコードが挿入された時刻を記録
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, paper_id),
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    FOREIGN KEY (paper_id) REFERENCES papers (id) ON DELETE CASCADE
);
