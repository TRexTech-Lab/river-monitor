const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// =========================
// 7日データ保存
// =========================
async function saveWeekData(obsId, weekData) {

  if (!weekData?.labels?.length) return;

  const rows = weekData.labels.map((t, i) => ({
    obs_id: obsId,
    obs_time: t,
    water_level: weekData.data[i]
  }));

  const { error } = await supabase
    .from("water_levels")
    .upsert(rows, { onConflict: ["obs_id","obs_time"] });

  if (error) {
    console.error("Supabase insert error:", error);
  } else {
    console.log("Supabase save success:", rows.length);
  }
}

// =========================
// 1か月取得
// =========================
async function getMonthData(obsId){

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await supabase
    .from("water_levels")
    .select("obs_time, water_level")
    .eq("obs_id", obsId)
    .gte("obs_time", since.toISOString())
    .order("obs_time", { ascending: true });

  if (error) {
    console.error("Month data error:", error);
    return { labels:[], data:[] };
  }

  return {
    labels: data.map(v => v.obs_time),
    data: data.map(v => v.water_level)
  };
}

// =========================
// 6か月取得
// =========================
async function getSixMonthData(obsId){

  const since = new Date();
  since.setMonth(since.getMonth() - 6);

  const { data, error } = await supabase
    .from("water_levels")
    .select("obs_time, water_level")
    .eq("obs_id", obsId)
    .gte("obs_time", since.toISOString())
    .order("obs_time", { ascending: true });

  if (error) {
    console.error("SixMonth data error:", error);
    return { labels:[], data:[] };
  }

  return {
    labels: data.map(v => v.obs_time),
    data: data.map(v => v.water_level)
  };
}

module.exports = {
  saveWeekData,
  getMonthData,
  getSixMonthData
};
