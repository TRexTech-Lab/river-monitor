const express = require("express");
const router = express.Router();
const { getWeekData } = require("../services/riverService");
const obsPoints = require("../services/obsPoints");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const BATCH_SIZE = 500; // バッチサイズ

// =========================
// 🔐 定期保存用エンドポイント
// =========================
router.get("/save", async (req, res) => {
  try {
    if (req.query.key !== process.env.CRON_KEY) {
      return res.status(403).send("Forbidden");
    }

    console.log("Cron save triggered");

     // 並列処理
    await Promise.all(
      obsPoints.map(async (p) => {
        try {
          const weekData = await getWeekData(p.obs_id);
          const labels = weekData.labels || [];
          const data = weekData.data || [];
          if (!labels.length || !data.length) return;

          // --- labels と data を結合 ---
          const rows = [];
          const seen = new Set();
          labels.forEach((time, i) => {
            const key = `${p.obs_id}_${time}`;
            if (!seen.has(key)) {
              rows.push({ obs_id: p.obs_id, obs_time: time, water_level: data[i] });
              seen.add(key);
            }
          });

          // 重複除去
          const uniqueRows = Array.from(
            rows.reduce((map, row) => {
              const key = `${row.obs_id}_${row.obs_time}`;
              if (!map.has(key)) map.set(key, row);
              return map;
            }, new Map()).values()
          );

          // --- バッチ upsert ---
          for (let i = 0; i < uniqueRows.length; i += BATCH_SIZE) {
            const batch = uniqueRows.slice(i, i + BATCH_SIZE);
            const { error } = await supabase
              .from("water_levels")
              .upsert(batch, { onConflict: ["obs_id", "obs_time"] });
            if (error) console.error("Batch upsert error:", p.obs_id, error);
          }

          console.log(`Saved: ${p.obs_id} (${uniqueRows.length} rows)`);

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
