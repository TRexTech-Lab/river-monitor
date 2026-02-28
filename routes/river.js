const express = require("express");
const router = express.Router();
const riverService = require("../services/riverService");

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

router.get("/current", async (req, res) => {
  try {
    const { labels, data } = await riverService.getCurrentWaterLevel(obsId);
    res.send(riverService.buildChartHtml("Current Water Level", labels, data));
  } catch (err) {
    res.send("Error: " + err.message);
  }
});

router.get("/week", async (req, res) => {
  try {
    const { labels, data } = await riverService.getWeekData(obsId);
    res.send(riverService.buildChartHtml("Past 7 Days Water Level", labels, data));
  } catch (err) {
    res.send("Error: " + err.message);
  }
});

/*
router.get("/both", async (req, res) => {
  const obsId = req.query.obsId || "2155500400010"; // デフォルト観測ポイント
  try {
    const current = await riverService.getCurrentWaterLevel(obsId);
    const week = await riverService.getWeekData(obsId);
    res.send(riverService.buildDoubleChartHtml(
      "Current Water Level", current.labels, current.data,
      "Past Week Water Level", week.labels, week.data,
      obsId // HTML 側で select の値を初期設定
    ));
  } catch (err) {
    console.error("both route error:", err);
    res.status(500).send("Error fetching water level data");
  }
});
*/

app.get("/both", async (req, res) => {
  const obsId = req.query.obsId || "2155500400010";

  const current = await getCurrentWaterLevel(obsId);
  const week = await getWeekData(obsId);

  res.json({ current, week });
});

app.get("/", async (req, res) => {
  const obsId = req.query.obsId || "2155500400010";
  const current = await getCurrentWaterLevel(obsId);
  const week = await getWeekData(obsId);

  const html = buildDoubleChartHtml(
    "Current Water Level",
    current.labels,
    current.data,
    "Past Week Water Level",
    week.labels,
    week.data,
    obsId
  );

    res.send(html);
});
  
app.listen(3000, () => console.log("Server running on http://localhost:3000"));
module.exports = router;
