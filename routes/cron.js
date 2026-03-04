const express = require("express");
const router = express.Router();

const { getWeekData } = require("../services/riverService");
const { saveWeekData } = require("../services/supabaseService");
const obsPoints = require("../services/obsPoints");

// =========================
// 🔐 定期保存用エンドポイント
// =========================
// 例: /cron/save?key=xxxx
router.get("/save", async (req, res) => {
  try {
    // 簡易キー認証
    if (req.query.key !== process.env.CRON_SECRET) {
      return res.status(403).send("Forbidden");
    }

    console.log("Cron save triggered");

    await Promise.all(
      obsPoints.map(async (p) => {
        try {
          const weekData = await getWeekData(p.obs_id);

          if (!weekData?.labels?.length) {
            console.log("No data:", p.obs_id);
            return;
          }

          await saveWeekData(p.obs_id, weekData);
          console.log("Saved:", p.obs_id);

        } catch (err) {
          console.error("Error saving:", p.obs_id, err.message);
        }
      })
    );

    console.log("Cron save completed");
    res.send("Saved");

  } catch (err) {
    console.error("Cron save error:", err);
    res.status(500).send("Error");
  }
});

module.exports = router;
