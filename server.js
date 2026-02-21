const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

// ルート読み込み
const waterlevelRoutes = require("./routes/waterlevel");
const healthRoutes = require("./routes/health");

// トップ確認用
app.get("/", (req, res) => {
  res.send("River Monitor Server is running!");
});

// ルーティング分離
app.use("/waterlevel", waterlevelRoutes);
app.use("/health", healthRoutes);

// サーバー起動
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
