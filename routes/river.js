const express = require("express");
const router = express.Router();
const riverService = require("../services/riverService");

// 健康チェック
router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// 両方グラフ（10分・1時間・1週間）
router.get("/WaterLevel", async (req, res) => {
  const obsId = req.query.obsId || "2155500400010";
  try {
    const current10min = await riverService.getCurrentWaterLevel10min(obsId);
    const currentHour = await riverService.getCurrentWaterLevelHour(obsId);
    const week = await riverService.getWeekData(obsId);

    if (req.query.json) {
      res.json({ current10min, currentHour, week });
    } else {
      res.send(riverService.buildTripleChartHtml(
        "8h-Water Level (m)",
        current10min.labels,
        current10min.data,
        "3d-Water Level (m)",
        currentHour.labels,
        currentHour.data,
        "10d-Water Level (m)",
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
