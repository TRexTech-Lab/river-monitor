const express = require("express");
const router = express.Router();

const { getWeekData } = require("../services/riverService");
const { saveWeekData } = require("../services/supabaseService");
const obsPoints = require("../services/obsPoints");

// 🔐 まずは最初の1観測所でテスト
const OBS_ID = obsPoints[0].obs_id;

router.get("/save", async (req, res) => {
  try {
    // 簡易キー認証（UptimeRobotのURL ?key=xxx と一致させる）
    if (req.query.key !== process.env.CRON_SECRET) {
      return res.status(403).send("Forbidden");
    }

    console.log("Cron save triggered:", OBS_ID);

    const weekData = await getWeekData(OBS_ID);

    if (!weekData?.labels?.length) {
      console.log("No week data found");
      return res.send("No data");
    }

    await saveWeekData(OBS_ID, weekData);

    console.log("Cron save completed");
    res.send("Saved");

  } catch (err) {
    console.error("Cron save error:", err);
    res.status(500).send("Error");
  }
});

module.exports = router;
