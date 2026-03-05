const express = require("express");
const riverRouter = require("./routes/river");
const cronRouter = require("./routes/cron");
const healthRoutes = require("./routes/health");

const app = express();

// =========================
// ルート登録 
// =========================
app.use(express.json());
app.use("/", riverRouter);
app.use("/cron", cronRouter);

// =========================
// サーバー起動
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
