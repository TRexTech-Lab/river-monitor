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
        //console.log("weekData sample:", weekData);
        //console.log("DEBUG", p.obs_id, weekData.labels?.length);
        
        const labels = weekData.labels || [];
        const data = weekData.data || [];

        if (!labels.length || !data.length) {
          console.log("No data:", p.obs_id);
          continue;
        }

        // --- labels と data を結合して Supabase に入れる形に整形 ---
        const rows = [];
        const seen = new Set();
        
        labels.forEach((time, i) => {
          const key = `${p.obs_id}_${time}`;
          if (!seen.has(key)) {
            rows.push({
              obs_id: p.obs_id,
              obs_time: time,
              water_level: data[i],
            });
            seen.add(key);
          }
        });

        // rows を再度ユニーク化
        const uniqueRows = Array.from(
          rows.reduce((map, row) => {
            const key = `${row.obs_id}_${row.obs_time}`;
            if (!map.has(key)) map.set(key, row);
            return map;
          }, new Map()).values()
        );
        
        // --- Supabase に丸ごと upsert ---
        const { error } = await supabase
          .from("water_levels")
          .upsert(uniqueRows, { onConflict: ["obs_id", "obs_time"] });
        
        if (error) {
          console.error("Supabase error:", p.obs_id, error);
        } else {
          console.log(`Saved: ${p.obs_id} (${rows.length} rows)`);
        }

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
