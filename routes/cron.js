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
        // --- weekData を取得 ---
        const weekData = await getWeekData(p.obs_id);

        // 空配列ならスキップ
        const dataArray = weekData.values || [];
        if (!dataArray.length) {
          console.log("No data:", p.obs_id);
          continue;
        }

        // --- Supabase に丸ごと upsert ---
        // obs_id を各行に追加して、onConflict で重複は自動回避
        await supabase
          .from("water_levels")
          .upsert(
            dataArray.map(r => ({ ...r, obs_id: p.obs_id })),
            { onConflict: ["obs_id", "obs_time"] }
          );

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
