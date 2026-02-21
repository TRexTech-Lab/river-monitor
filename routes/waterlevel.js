const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    river: "Sample River",
    level: 2.34,
    unit: "m",
    status: "normal"
  });
});

module.exports = router;
