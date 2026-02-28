const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// 観測所ID（固定）
const OBS_ID = "2155500400010";

// 現在時刻API（Networkで見つけたやつに置き換えてOK）
const TIME_URL = "https://www.river.go.jp/kawabou/file/system/tmCrntTime.json";

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/waterlevel", async (req, res) => {
  try {
    // ① 現在時刻取得
    const timeRes = await axios.get(TIME_URL);
    const currentTime = timeRes.data.obsValue?.obsTime 
      || timeRes.data.crntObsTime;

    if (!currentTime) {
      return res.json({ error: "時刻データ取得失敗" });
    }

    // ② 日付と時刻整形
    // 例: "2026/02/28 11:40"
    const date = currentTime.slice(0, 10).replaceAll("/", "");
    const time = currentTime.slice(11, 16).replace(":", "");

    // ③ 本命URL組み立て
    const dataUrl = `https://www.river.go.jp/kawabou/file/files/tmlist/stg/${date}/${time}/${OBS_ID}.json`;

    const dataRes = await axios.get(dataUrl);

    res.json(dataRes.data);

  } catch (err) {
    res.json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
