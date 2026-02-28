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

router.get("/both", async (req, res) => {
  try {
    const current = await　riverService.getCurrentWaterLevel().catch(e => { console.error("current error", e); return {labels: [], data: []}; });
    const week = await riverService.getWeekData().catch(e => { console.error("week error", e); return {labels: [], data: []}; });
    res.send(
      riverService.buildDoubleChartHtml(
        "Current Water Level", current.labels, current.data,
        "Past Week Water Level", week.labels, week.data
      )
    );
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching water level data");
  }
});

module.exports = router;
