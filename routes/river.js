const express = require("express");
const router = express.Router();
const riverService = require("../services/riverService");

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

router.get("/waterlevel", async (req, res) => {
  try {
    const data = await riverService.getCurrentWaterLevel();
    res.json(data);
  } catch (err) {
    res.json({ error: err.message });
  }
});

router.get("/weekgraph", async (req, res) => {
  try {
    const { labels, data } = await riverService.getWeekData();
    res.send(riverService.buildChartHtml("Past 7 Days Water Level", labels, data));
  } catch (err) {
    res.send("Error: " + err.message);
  }
});

module.exports = router;
