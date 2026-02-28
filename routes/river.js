const express = require("express");
const router = express.Router();
const riverService = require("../services/riverService");

// 健康チェック
router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// 現在の水位グラフ（10min）
router.get("/current10min", async (req, res) => {
  const obsId = req.query.obsId || "2155500400010";
  try {
    const { labels, data } = await riverService.getCurrentWaterLevel10min(obsId);
    res.send(riverService.buildChartHtml("Current Water Level", labels, data));
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

// 現在の水位グラフ（Hour）
router.get("/currentHour", async (req, res) => {
  const obsId = req.query.obsId || "2155500400010";
  try {
    const { labels, data } = await riverService.getCurrentWaterLevelHour(obsId);
    res.send(riverService.buildChartHtml("Current Water Level", labels, data));
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

// 過去7日分グラフ（単独）
router.get("/week", async (req, res) => {
  const obsId = req.query.obsId || "2155500400010";
  try {
    const { labels, data } = await riverService.getWeekData(obsId);
    res.send(riverService.buildChartHtml("Past 7 Days Water Level", labels, data));
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

// 両方グラフ（HTML or JSON）
router.get("/both", async (req, res) => {
  const obsId = req.query.obsId || "2155500400010";
  try {
    const current10min = await riverService.getCurrentWaterLevel10min(obsId);
    const week = await riverService.getWeekData(obsId);

    if (req.query.json) {
      res.json({ current, week }); // JSONで返す
    } else {
      res.send(riverService.buildDoubleChartHtml(
        "Current Water Level",
        current10min.labels,
        current10min.data,
        "Past Week Water Level",
        week.labels,
        week.data,
        obsId
      ));
    }
  } catch (err) {
    console.error("both route error:", err);
    res.status(500).send("Error fetching water level data");
  }
});

module.exports = router;
