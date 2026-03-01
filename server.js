const express = require("express");
const app = express();
const riverRouter = require("./routes/river");

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

app.use(express.static("public")); // 必要なら静的ファイル
app.use("/", riverRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

async function testInsert() {
  const { data, error } = await supabase
    .from('water_levels')
    .insert([
      {
        obs_id: "test",
        obs_time: new Date(),
        water_level: 1.23
      }
    ]);

  if (error) {
    console.error("Insert error:", error);
  } else {
    console.log("Insert success");
  }
}

testInsert();
