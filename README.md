# 株式ポートフォリオ管理アプリ

日本株・米国株・投資信託の保有銘柄を登録し、株価・配当金・損益を自動計算して一覧表示する PWA。
Vercel にデプロイして、PC・スマホのブラウザから同じデータを見られる。

## 構成

| ディレクトリ | 役割 |
|---|---|
| `api/` | Vercel Functions。`api/*.ts` が各エンドポイント、`api/_lib/` が共通ロジック(Yahoo取得・計算・KV・認証) |
| `client/` | React (Vite) の SPA。ビルド結果 `client/dist/` を Vercel が静的配信 |
| `dev-server.ts` | ローカル開発用。`api/` のハンドラを Express に載せて `vercel dev` なしで動かす |

### データの流れ

```
ブラウザ ──/api/portfolio──▶ KV のスナップショットを返すだけ(高速)
                              ▲
        /api/refresh ─────────┘  Yahoo から全銘柄を取得して KV に保存
        (Vercel Cron 15分ごと / 古ければリクエスト時にバックグラウンド更新)
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
- Framework Preset: **Other**(`vercel.json` で build/output を指定済み)
- 設定はそのまま(`vercel.json` が反映される):
  - Build Command: `npm run build`
  - Output Directory: `client/dist`

### 3. KV(Upstash Redis)を接続

- Vercel のプロジェクト → **Storage** → **Marketplace** から **Upstash for Redis** を作成し、プロジェクトに Connect
- `KV_REST_API_URL` / `KV_REST_API_TOKEN`(または `UPSTASH_REDIS_REST_URL` / `_TOKEN`)が自動で環境変数に入る

### 4. 環境変数を設定

Vercel → Settings → Environment Variables(`.env.example` 参照):

| 変数 | 値 | 用途 |
|---|---|---|
| `APP_PASSWORD` | 好きなパスワード | ログイン。未設定だと誰でもアクセス可 |
| `AUTH_SECRET` | 長いランダム文字列 | セッション Cookie の署名。`openssl rand -base64 32` |
| `CRON_SECRET` | 長いランダム文字列 | Vercel Cron が `/api/refresh` を呼ぶときの認証 |
| `REFRESH_KEY` | (任意)ランダム文字列 | `/api/refresh?key=...` で手動更新したいとき |

### 5. デプロイ

`git push` で自動デプロイ。初回アクセス時にスナップショットが空なので、その場で Yahoo 取得が走る(数十秒)。以降は `vercel.json` の Cron(`*/15 * * * *`)が更新し続ける。

> Hobby プランは Cron の実行間隔・精度に制限がある。正確な間隔が要るなら外部 cron(cron-job.org 等)から
> `https://<your-app>/api/refresh?key=<REFRESH_KEY>` を叩く。リクエスト時のバックグラウンド更新もあるので必須ではない。

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
