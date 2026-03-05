const express = require("express");
const router = express.Router();
const riverService = require("../services/riverService");

const {
  getMonthDataFromDB,
  getSixMonthDataFromDB
} = require("../services/supabaseService");

// =========================
// 健康チェック
// =========================
router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// =========================
// グラフ表示（5枚表示）
// =========================
router.get("/waterlevel", async (req, res) => {

  const obsId = req.query.obsId || "2155500400010";

  try {

    const h8  = await riverService.getCurrentWaterLevel10min(obsId);
    const d3  = await riverService.getCurrentWaterLevelHour(obsId);
    const d7  = await riverService.getWeekData(obsId);

    const m1  = await getMonthDataFromDB(obsId);
    const m6  = await getSixMonthDataFromDB(obsId);

    if (req.query.json) {
      return res.json({
        h8,
        d3,
        d7,
        m1,
        m6
      });
    }

    res.send(
      riverService.buildFiveChartHtml(

        "8h-Water Level (m)",
        h8.labels,
        h8.data,

        "3d-Water Level (m)",
        d3.labels,
        d3.data,

        "7d-Water Level (m)",
        d7.labels,
        d7.data,

        "1M-Water Level (m)",
        m1.labels,
        m1.data,

        "6M-Water Level (m)",
        m6.labels,
        m6.data,

        obsId
      )
    );

  } catch (err) {

    console.error("waterlevel route error:", err);

    res.status(500).send("Error fetching water level data");
  }
});

module.exports = router;
