const express = require("express");
const app = express();
const port = 3000;
const riverService = require("./services/riverService");

app.use(express.json());

// --- Health check ---
app.get("/health", (req,res)=>res.json({status:"ok"}));

// --- Current single graph ---
app.get("/current", async (req,res)=>{
  const obsId = req.query.obsId || "2155500400010";
  try {
    const current = await riverService.getCurrentWaterLevel(obsId);
    res.send(riverService.buildSingleChartHtml("Current Water Level", current.labels, current.data, obsId));
  } catch(err){
    console.error("current route error:", err);
    res.status(500).send("Error fetching current water level data");
  }
});

// --- Past week single graph ---
app.get("/week", async (req,res)=>{
  const obsId = req.query.obsId || "2155500400010";
  try {
    const week = await riverService.getWeekData(obsId);
    res.send(riverService.buildSingleChartHtml("Past Week Water Level", week.labels, week.data, obsId));
  } catch(err){
    console.error("week route error:", err);
    res.status(500).send("Error fetching week water level data");
  }
});

// --- Both graphs ---
app.get("/both", async (req,res)=>{
  const obsId = req.query.obsId || "2155500400010";
  try {
    const current = await riverService.getCurrentWaterLevel(obsId);
    const week = await riverService.getWeekData(obsId);
    res.send(riverService.buildDoubleChartHtml(
      "Current Water Level", current.labels, current.data,
      "Past Week Water Level", week.labels, week.data,
      obsId
    ));
  } catch(err){
    console.error("both route error:", err);
    res.status(500).send("Error fetching water level data");
  }
});

app.listen(port, ()=>console.log(`Server running at http://localhost:${port}`));
