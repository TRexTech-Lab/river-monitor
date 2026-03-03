const express = require("express");
const app = express();
const riverRouter = require("./routes/river");
const cronRouter = require("./routes/cron");

app.use(express.json());
app.use("/", riverRouter);
app.use("/cron", cronRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
