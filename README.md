# PaperDeck

学術論文のアブストラクトをカード形式で流し読みできるWebアプリ。

## 構成

| ディレクトリ | 技術スタック |
|---|---|
| `backend/` | Hono + Cloudflare Workers + D1 |
| `frontend/` | React 19 + Vite + TanStack Query + React Router |
| `crawler/` | cheerio + commander（CLIツール） |

## 開発

```bash
pnpm install
pnpm migrate                        # ローカルD1にテーブル作成
pnpm crawl https://www.usenix.org/conference/usenixsecurity25/technical-sessions  # 論文データ投入
pnpm dev:backend                    # バックエンド (Wrangler)
pnpm dev:frontend                   # フロントエンド (Vite)
```

## テスト・リント

```bash
pnpm --filter backend test
pnpm --filter frontend test
pnpm --filter crawler test
pnpm check                          # Biome lint & format (チェックのみ)
pnpm check:fix                      # Biome lint & format (自動修正)
```

## デプロイ

### 初回セットアップ

```bash
# 1. D1データベース作成 → 出力されるdatabase_idをbackend/wrangler.tomlに設定
npx wrangler d1 create paperdeck-db

# 2. JWT用シークレットを生成して backend/.env に保存
echo "JWT_SECRET=$(head -c 32 /dev/urandom | base64)" > backend/.env

# 3. 本番用シークレット設定（backend/ ディレクトリから実行）
cd backend && npx wrangler secret put JWT_SECRET && cd ..
```

### マイグレーション & データ投入

```bash
pnpm migrate:remote                 # リモートD1にマイグレーション適用
pnpm crawl --remote https://www.usenix.org/conference/usenixsecurity25/technical-sessions
```

### デプロイ実行

```bash
pnpm publish:cf                     # frontend build → wrangler deploy
```
