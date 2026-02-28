const express = require("express");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

// Pythonが書き込むJSONファイル
const CACHE_FILE = path.join(__dirname, "python", "waterlevel_cache.json");

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

function runWaterFetch() {
  console.log("Running water fetch...");

  const scriptPath = path.join(__dirname, "python", "fetch_waterlevel.py");
  
  exec(`python3 ${scriptPath}`, (err, stdout, stderr) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(stdout);
  });
}

// 1時間ごとに実行
setInterval(runWaterFetch, 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.get("/waterlevel", (req, res) => {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, "utf-8");
      res.setHeader("Content-Type", "application/json");
      res.send(data);
    } else {
      res.json({ error: "No water level data yet" });
    }
  } catch (err) {
    res.json({ error: err.message });
  }
});

