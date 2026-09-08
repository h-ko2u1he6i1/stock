# 株式ポートフォリオ管理アプリ

日本株・米国株・投資信託の保有銘柄を登録し、株価・配当金・損益を自動計算して一覧表示する PWA。
Vercel にデプロイして、PC・スマホのブラウザから同じデータを見られる。

## 構成

| ディレクトリ | 役割 |
|---|---|
| `api/` | Vercel Functions。`api/*.ts` が各エンドポイント、`api/_lib/` が共通ロジック(Yahoo取得・計算・KV・認証) |
| `client/` | React (Vite) の SPA。ビルド結果はリポジトリ直下の `dist/` に出力され、Vercel が静的配信 |
| `dev-server.ts` | ローカル開発用。`api/` のハンドラを Express に載せて `vercel dev` なしで動かす |

### データの流れ

```
ブラウザ ──/api/portfolio──▶ KV のスナップショットを返すだけ(高速)
                              ▲
        /api/refresh ─────────┘  Yahoo から全銘柄を取得して KV に保存
        (Vercel Cron 1日1回 + アプリを開いた時にスナップショットが15分以上古ければ
         バックグラウンドで更新)
```

- 保有銘柄(`stock:positions`)と価格スナップショット(`stock:snapshot`)を KV に保存
- 株価・配当・為替は保存対象の一部だが、`refresh` のたびに Yahoo から取り直す
- 配当月・1株配当は Yahoo の「直近1年の権利落ち実績」ベース。決算発表の予想は反映されない(実績が出て初めて反映)

## ローカル開発

```bash
npm install
npm run dev
```

- API: http://localhost:3001 、フロント: http://localhost:5173(`/api` は Vite がプロキシ)
- 環境変数なしで動く: 認証オフ、KV の代わりに `api/_lib/data/.local-store.json` を使用
- 保有銘柄は空の状態で始まる。UI の「銘柄を追加」フォームから登録する
  （`api/_lib/data/positions.seed.json` に配列を書けば初期銘柄を seed できる）

型チェック / ビルド:

```bash
npm run typecheck
npm run build
```

PWA アイコンを作り直す(`client/scripts/icon.svg` を編集したとき):

```bash
npm run icons -w client
```

## Vercel へのデプロイ

### 1. リポジトリを用意

`stock/` はまだ単独の Git リポジトリではない(親ディレクトリの repo に含まれている)。単独化する:

```bash
cd stock
git init
git add -A
git commit -m "stock portfolio app"
gh repo create stock-portfolio --private --source=. --push
```

### 2. Vercel プロジェクトを作成

- [vercel.com/new](https://vercel.com/new) で上記リポジトリを import
- Framework Preset: **Other**、Root Directory: リポジトリ直下(`.`)のまま
- ビルド設定は `vercel.json` が指定するので触らない:
  - Build Command: `npm run build`(client をビルドして `dist/` に出力)
  - Output Directory: `dist`

### 3. KV(Upstash Redis)を接続

- Vercel のプロジェクト → **Storage** → **Marketplace** から **Upstash for Redis** を作成し、プロジェクトに Connect
- `KV_REST_API_URL` / `KV_REST_API_TOKEN`(または `UPSTASH_REDIS_REST_URL` / `_TOKEN`)が自動で環境変数に入る

### 4. 環境変数を設定

Vercel → Settings → Environment Variables(`.env.example` 参照):

| 変数 | 値 | 用途 |
|---|---|---|
| `APP_PASSWORD` | 好きなパスワード | オーナー用ログイン。実データにフルアクセス。未設定だと誰でもアクセス可 |
| `VIEWER_PASSWORD` | 別のパスワード（任意） | デモ用ログイン。サンプル銘柄の**別ポートフォリオ**。追加・編集・削除は自由（デモ範囲内のみ）。実データは見えない・触れない。レビュアーに配る |
| `AUTH_SECRET` | 長いランダム文字列 | セッション Cookie の署名。`openssl rand -base64 32` |
| `CRON_SECRET` | 長いランダム文字列 | Vercel Cron が `/api/refresh` を呼ぶときの認証 |
| `REFRESH_KEY` | (任意)ランダム文字列 | `/api/refresh?key=...` で手動更新したいとき |

**レビュアーに見せる場合**: `VIEWER_PASSWORD` を設定し、その値をレビュアーに渡す。デモ用アカウントは
`api/_lib/data/positions.viewer-seed.json` のサンプル銘柄で始まり、追加・編集・削除を自由に試せる。
書き込み先は `stock:viewer:*`、あなたの実データ（`APP_PASSWORD`、`stock:*`）とは KV 上で完全に分離。
複数のレビュアーは同じデモ用ポートフォリオを共有する（1人の変更が全員に見える）。

### 5. デプロイ

`git push` で自動デプロイ。初回アクセス時にスナップショットが空なので、その場で Yahoo 取得が走る(数十秒)。

**Cron について**: Hobby プランは **1日1回まで**なので `vercel.json` は `0 7 * * *`(UTC、= JST 16:00 / 東証引け後)に設定。日中の値動きは「アプリを開いた時にスナップショットが15分以上古ければバックグラウンド更新」で追従する。
もっと頻繁に自動更新したい場合は、外部 cron(cron-job.org 等)から数分間隔で
`https://<your-app>/api/refresh?key=<REFRESH_KEY>` を叩く(`REFRESH_KEY` を環境変数に設定)。

### 6. スマホにインストール

デプロイ URL をスマホのブラウザで開き、「ホーム画面に追加」。iOS は Safari から。

## API エンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/portfolio` | ポートフォリオ(スナップショット)。`?refresh=1` で強制再取得 |
| POST | `/api/positions` | 銘柄追加 `{ code, quantity, avgCost?, acquiredDate? }` |
| PUT | `/api/positions/:code` | 保有数・取得単価の更新 |
| DELETE | `/api/positions/:code` | 銘柄削除 |
| GET | `/api/search?q=` | 銘柄名・コード検索 |
| GET | `/api/chart?code=&range=` | 株価チャート(終値の時系列)。`range` は `1M`/`3M`/`6M`/`1Y`/`5Y`。株式のみ、1時間 KV キャッシュ |
| GET/POST | `/api/refresh` | スナップショット再構築(Cron / 手動) |
| POST | `/api/login` / `/api/logout` | ログイン / ログアウト |
| GET | `/api/session` | 認証状態 |
