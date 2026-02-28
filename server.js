const express = require("express");
const riverRoutes = require("./routes/river");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ルーティングをまとめて登録
app.use("/", riverRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
