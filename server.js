// server.js
const express = require("express");
const app = express();
const port = 3000;

// riverService.js は boku が作ったサービス
const riverService = require("./services/riverService");

// JSON のリクエスト body を扱えるように
app.use(express.json());

// ルート：動作確認
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// 現在の水位
app.get("/current", async (req, res) => {
  const obsId = req.query.obsId || "2155500400010";
  try {
    const { labels, data } = await riverService.getCurrentWaterLevel(obsId);
    res.send(riverService.buildChartHtml("Current Water Level", labels, data));
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

// 過去1週間の水位
app.get("/week", async (req, res) => {
  const obsId = req.query.obsId || "2155500400010";
  try {
    const { labels, data } = await riverService.getWeekData(obsId);
    res.send(riverService.buildChartHtml("Past 7 Days Water Level", labels, data));
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

// 両方のグラフを表示（観測ポイント切替可能）
app.get("/both", async (req, res) => {
  const obsId = req.query.obsId || "2155500400010";
  try {
    const current = await riverService.getCurrentWaterLevel(obsId);
    const week = await riverService.getWeekData(obsId);
    res.send(riverService.buildDoubleChartHtml(
      "Current Water Level", current.labels, current.data,
      "Past Week Water Level", week.labels, week.data,
      obsId
    ));
  } catch (err) {
    console.error("both route error:", err);
    res.status(500).send("Error fetching water level data");
  }
});

// サーバ起動
app.listen(port, () => {
  console.log(`River monitor app listening at http://localhost:${port}`);
});
