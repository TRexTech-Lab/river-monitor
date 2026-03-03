const express = require("express");
const router = express.Router();
const riverService = require("../services/riverService");
const { saveWeekData } = require("../services/supabaseService");
const obsPoints = require("../obsPoints");

// =========================
// 健康チェック
// =========================
router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// =========================
// グラフ表示（保存なし）
// =========================
router.get("/waterlevel", async (req, res) => {
  const obsId = req.query.obsId || "2155500400010";

  try {
    const current10min = await riverService.getCurrentWaterLevel10min(obsId);
    const currentHour = await riverService.getCurrentWaterLevelHour(obsId);
    const week = await riverService.getWeekData(obsId);

    if (req.query.json) {
      return res.json({ current10min, currentHour, week });
    }

    res.send(
      riverService.buildTripleChartHtml(
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
      )
    );

  } catch (err) {
    console.error("waterlevel route error:", err);
    res.status(500).send("Error fetching water level data");
  }
});

// =========================
// 自動保存用（cron専用）
// =========================
router.get("/cron/save", async (req, res) => {
  try {
    // 🔐 秘密キー確認
    if (req.query.key !== process.env.CRON_KEY) {
      return res.status(403).json({ error: "forbidden" });
    }

    // 並列保存
    await Promise.all(
      obsPoints.map(async (p) => {
        const week = await riverService.getWeekData(p.obs_id);
        await saveWeekData(p.obs_id, week);
        console.log("Saved:", p.obs_id);
      })
    );

    res.json({ status: "saved all points" });

  } catch (err) {
    console.error("cron save error:", err);
    res.status(500).json({ error: "save failed" });
  }
});

module.exports = router;
