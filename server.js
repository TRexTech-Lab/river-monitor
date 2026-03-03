const express = require("express");
const app = express();
const riverRouter = require("./routes/river");

app.use(express.json());
app.use("/", riverRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
