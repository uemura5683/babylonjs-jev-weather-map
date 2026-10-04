// 天気マップ + Jev(TypeSafe) PoC 用の最小サーバー
// 役割:
//   1) index.html などの静的ファイル配信
//   2) POST /api/judge … 天気stateを受け取り、Jevに「雨×風」の判定を投げて返す
//      （APIキーはサーバー側だけに置き、ブラウザには出さない）
//
// 追加依存なし。Node 20.6+ の `--env-file` でキーを読む:
//   node --env-file=.env server.js   （= npm start）

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.TYPESAFE_API_KEY;
const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

const ROOT = __dirname;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".ico": "image/x-icon",
};

// ---- Jev への問い（自由文の「目的」× 天気 → お出かけ適性を1問だけScoreで） ----
// criteria は index 0 が最も不適、末尾(4)が最も好適。レスポンスの score(0..4) で受ける。
// ここが「if文では書けない」領域: 自由文の意図を天気と突き合わせて常識で判断させる。
const OUTING_CRITERIA = [
  "天候的に困難または危険で、今は避けるべき",
  "無理ではないが、不快さやリスクが大きく、あまり向かない",
  "特段の支障はないが、快適とは言えない",
  "問題なく快適に実行できて、向いている",
  "その目的にとって理想的で、絶好のコンディション",
];

function buildJevRequest(state) {
  return {
    model: "jev-latest",
    state,
    questions: {
      outing: {
        type: "score",
        instructions:
          "指定された地域の現在の天気（state内の 天気・気温・風速・風向・現地時刻）のもとで、" +
          "ユーザーが今からやりたいこと（state.目的）を実行するのが、" +
          "どれくらい向いているか（快適さ・安全さ）を判定してください。",
        criteria: OUTING_CRITERIA,
      },
    },
  };
}

async function callJev(state) {
  const res = await fetch(JEV_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(buildJevRequest(state)),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jev API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function handleJudge(req, res) {
  if (!API_KEY) {
    return sendJson(res, 500, {
      error: "TYPESAFE_API_KEY が未設定です。.env に設定して再起動してください。",
    });
  }
  let raw = "";
  req.on("data", (c) => {
    raw += c;
    if (raw.length > 1e5) req.destroy(); // 過大なボディを弾く
  });
  req.on("end", async () => {
    let state;
    try {
      state = JSON.parse(raw || "{}");
    } catch {
      return sendJson(res, 400, { error: "JSONのパースに失敗しました" });
    }
    try {
      const jev = await callJev(state);
      const answer = jev?.answers?.outing;
      if (!answer) {
        return sendJson(res, 502, { error: "Jevの応答形式が想定外です", raw: jev });
      }
      // ブラウザには判定結果だけ返す（キーや生リクエストは出さない）
      sendJson(res, 200, {
        score: answer.score,
        probabilities: answer.probabilities,
        confidence: answer.confidence,
        legend: answer.legend,
      });
    } catch (e) {
      sendJson(res, 502, { error: String(e.message || e) });
    }
  });
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  // ディレクトリトラバーサル対策: ROOT の外へ出さない
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not Found");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/judge") {
    return handleJudge(req, res);
  }
  if (req.method === "GET") {
    return serveStatic(req, res);
  }
  res.writeHead(405);
  res.end("Method Not Allowed");
});

server.listen(PORT, () => {
  console.log(`\n  天気マップ → http://localhost:${PORT}`);
  console.log(`  Jev判定エンドポイント: POST /api/judge`);
  if (!API_KEY) {
    console.log("  ⚠  TYPESAFE_API_KEY 未設定（静的配信は動くが判定は500を返します）");
  }
  console.log("");
});
