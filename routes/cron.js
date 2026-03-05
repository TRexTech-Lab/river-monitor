const express = require("express");
const router = express.Router();
const { getWeekData } = require("../services/riverService");
const obsPoints = require("../services/obsPoints");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// =========================
// 🔐 定期保存用エンドポイント
// =========================
router.get("/save", async (req, res) => {
  try {
    if (req.query.key !== process.env.CRON_KEY) {
      return res.status(403).send("Forbidden");
    }

    console.log("Cron save triggered");

    for (const p of obsPoints) {
      try {
        const weekData = await getWeekData(p.obs_id);

        // sortAndFormat の返り値から値の配列を取得
        const dataArray = weekData.values || [];

        if (!dataArray.length) {
          console.log("No data:", p.obs_id);
          continue;
        }

        // --- 重複を削除 (obs_time ごとに最後の1件だけ残す) ---
        const uniqueWeekData = Array.from(
          new Map(dataArray.map(r => [r.obs_time, r])).values()
        );

        // --- Supabase に upsert ---
        await supabase
          .from("water_levels")
          .upsert(uniqueWeekData.map(r => ({ ...r, obs_id: p.obs_id })), {
            onConflict: ["obs_id", "obs_time"],
          });

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
