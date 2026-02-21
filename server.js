</> JavaScript
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("River Monitor Server is running!");
});

app.get("/waterlevel", (req, res) => {
  res.json({
    river: "Sample River",
    level: 2.34,
    unit: "m",
    status: "normal"
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
