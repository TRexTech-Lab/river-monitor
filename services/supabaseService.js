// supabaseService.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * 観測所の週間水位データを Supabase に保存
 * @param {string} obsId 観測所ID
 * @param {Object} weekData { labels: [...], data: [...] }
 */
async function saveWeekData(obsId, weekData) {
  if (!weekData?.labels?.length) return;

  const rows = [];
  const seen = new Map(); // obs_time 重複チェック用

  for (let i = 0; i < weekData.labels.length; i++) {
    const obsTime = weekData.labels[i];
    const waterLevel = weekData.data[i];

    if (waterLevel === null) continue;

    const key = obsTime; // obs_id は固定なので obs_time だけでOK
    if (seen.has(key)) continue; // 同じ obs_time はスキップ
    seen.set(key, true);

    rows.push({
      obs_id: obsId,
      obs_time: obsTime,
      water_level: waterLevel
    });
  }

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("water_levels")
    .upsert(rows, { onConflict: ["obs_id", "obs_time"] });

  if (error) {
    console.error("Supabase save error:", error.message);
  } else {
    console.log("Supabase save success:", rows.length, "rows");
  }
}

// --- 過去6ヶ月 ---
async function getSixMonthDataFromDB(obsId) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data, error } = await supabase
    .from("water_levels")
    .select("obs_time, water_level")
    .eq("obs_id", obsId)
    .gte("obs_time", sixMonthsAgo.toISOString())
    .order("obs_time", { ascending: true });

  if (error) {
    console.error("Supabase 6month fetch error:", error.message);
    return { labels: [], data: [] };
  }

  return {
    labels: data.map(d => d.obs_time.slice(0,10)),
    data: data.map(d => d.water_level)
  };
}

module.exports = { 
  saveWeekData,
  getSixMonthDataFromDB
};
