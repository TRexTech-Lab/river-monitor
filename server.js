const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Pythonが書き込むJSONファイル
const CACHE_FILE = path.join(__dirname, "python", "waterlevel_cache.json");

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
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

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
