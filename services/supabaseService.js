const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function saveWeekData(obsId, weekData) {
  if (!weekData?.labels?.length) return;

  const rows = [];

  for (let i = 0; i < weekData.labels.length; i++) {
    const obsTime = weekData.labels[i];
    const waterLevel = weekData.data[i];

    if (waterLevel === null) continue;

    rows.push({
      obs_id: obsId,
      obs_time: obsTime,
      water_level: waterLevel
    });
  }

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("water_levels_week")
    .upsert(rows, { onConflict: ["obs_id", "obs_time"] });

  if (error) {
    console.error("Supabase save error:", error.message);
  } else {
    console.log("Supabase save success:", rows.length);
  }
}

module.exports = { saveWeekData };
