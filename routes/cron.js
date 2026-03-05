const express = require("express");
const router = express.Router();

const { getWeekData } = require("../services/riverService");
const { saveWeekData } = require("../services/supabaseService");
const obsPoints = require("../services/obsPoints");

// =========================
// 🔐 定期保存用エンドポイント
// =========================
router.get("/save", async (req, res) => {
  try {

    if (req.query.key !== process.env.CRON_SECRET) {
      return res.status(403).send("Forbidden");
    }

    console.log("Cron save triggered");

    for (const p of obsPoints) {
      try {

        const weekData = await getWeekData(p.obs_id);

        if (!weekData?.labels?.length) {
          console.log("No data:", p.obs_id);
          continue;
        }

        await saveWeekData(p.obs_id, weekData);

        console.log("Saved:", p.obs_id);

      } catch (err) {
        console.error("Error saving:", p.obs_id, err.message);
      }
    }

    console.log("Cron save completed");
    res.send("Saved");

  } catch (err) {
    console.error("Cron save error:", err);
    res.status(500).send("Error");
  }
});

module.exports = router;
