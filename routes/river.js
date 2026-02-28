const express = require("express");
const router = express.Router();
const riverService = require("../services/riverService");

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

router.get("/current", async (req, res) => {
  try {
    const { labels, data } = await riverService.getCurrentWaterLevel();
    res.send(riverService.buildChartHtml("Current Water Level", labels, data));
  } catch (err) {
    res.send("Error: " + err.message);
  }
});

router.get("/week", async (req, res) => {
  try {
    const { labels, data } = await riverService.getWeekData();
    res.send(riverService.buildChartHtml("Past 7 Days Water Level", labels, data));
  } catch (err) {
    res.send("Error: " + err.message);
  }
});

module.exports = router;
