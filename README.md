# Babylon.js × Jev(TypeSafe) 3Dお天気マップ

日本列島の3Dお天気マップに、Jev（TypeSafe）を組み合わせて
「犬の散歩に行ける？」のような自由文の質問に答える「お出かけ判定」を追加した PoC です。

技術書典21「Babylon.js レシピ集 Vol.9」収録章のサンプルコードです。

## 使っている主な要素

- **Babylon.js 9 の Atmosphere** … 物理ベースの大気。時刻で太陽の向き・空の色・明るさ（昼夜）が変わる
- **MSDF Text** … 3D空間に時刻・気温・天気・風速をくっきり表示
- **Open-Meteo API** … 登録もAPIキーも不要で、緯度・経度から現在の天気を取得できる無料API
- **Jev（TypeSafe）** … 自由文の意図といまの天気を突き合わせて「お出かけ判定」を返す

## 構成

| ファイル | 役割 |
|---|---|
| `index.html` | Babylon.js 製フロント（3Dマップ／天気表現／MSDF Text／お出かけ入力） |
| `server.js` | APIキーを隠す中継サーバー（静的配信 + `/api/judge`） |
| `textures/` | 日本列島のハイトマップなどのアセット |
| `movie.mp4` | 時計シリンダーに貼る映像テクスチャ（`VideoTexture`） |

## セットアップ

Node.js 20.6 以上が必要です（追加ライブラリはありません）。

1. APIキーを設定する

   ```bash
   cp .env.example .env
   # .env を開いて TYPESAFE_API_KEY に自分のキーを設定する
   ```

2. 起動する

   ```bash
   npm start
   ```

3. ブラウザで http://localhost:3000 を開く

## デモ（天気の強制切り替え）

実際の天気が雨でないと判定が出にくいため、URLで天気を強制できます。

```
http://localhost:3000/?demoRain=1&wind=12
```

## 注意

- `.env`（実APIキー）はコミットしないでください（`.gitignore` 済み）。
- `.env.example` はダミー値のテンプレートです。各自のキーに置き換えて使ってください。
