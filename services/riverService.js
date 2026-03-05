const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);


// ============================
// 1時間データ保存
// ============================
async function saveHourData(obsId, hourData) {

  if (!hourData?.labels?.length) return;

  const rows = hourData.labels.map((t, i) => ({
    obs_id: obsId,
    obs_time: t,
    water_level: hourData.data[i]
  }));

  const { error } = await supabase
    .from("water_levels")
    .upsert(rows, {
      onConflict: "obs_id,obs_time"
    });

  if (error) {
    console.error("Supabase save error:", error);
  } else {
    console.log("Supabase save success:", rows.length, "rows");
  }
}


// ============================
// 1ヶ月取得
// ============================
async function getMonthDataFromDB(obsId) {

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await supabase
    .from("water_levels")
    .select("*")
    .eq("obs_id", obsId)
    .gte("obs_time", since.toISOString())
    .order("obs_time", { ascending: true });

  if (error) {
    console.error("Supabase month fetch error:", error);
    return { labels: [], data: [] };
  }

  return {
    labels: data.map(v => v.obs_time),
    data: data.map(v => v.water_level)
  };
}


// ============================
// 6ヶ月取得
// ============================
async function getSixMonthDataFromDB(obsId) {

  const since = new Date();
  since.setMonth(since.getMonth() - 6);

  const { data, error } = await supabase
    .from("water_levels")
    .select("*")
    .eq("obs_id", obsId)
    .gte("obs_time", since.toISOString())
    .order("obs_time", { ascending: true });

  if (error) {
    console.error("Supabase sixMonth fetch error:", error);
    return { labels: [], data: [] };
  }

  return {
    labels: data.map(v => v.obs_time),
    data: data.map(v => v.water_level)
  };
}


// ============================
// export
// ============================
module.exports = {
  saveHourData,
  getMonthDataFromDB,
  getSixMonthDataFromDB
};
