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

app.get("/graph", async (req, res) => {
  try {
    const timeRes = await axios.get(TIME_URL);
    const currentTime = timeRes.data.obsValue?.obsTime 
      || timeRes.data.crntObsTime;

    const date = currentTime.slice(0, 10).replaceAll("/", "");
    const time = currentTime.slice(11, 16).replace(":", "");
    const dataUrl = `https://www.river.go.jp/kawabou/file/files/tmlist/stg/${date}/${time}/${OBS_ID}.json`;

    const dataRes = await axios.get(dataUrl);
    const values = dataRes.data.min10Values.filter(v => v.stg !== null);

    const labels = values.map(v => v.obsTime).reverse();
    const data = values.map(v => v.stg).reverse();

    res.send(`
      <html>
      <head>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      </head>
      <body>
        <h2>River Water Level</h2>
        <canvas id="myChart"></canvas>
        <script>
          const ctx = document.getElementById('myChart');
          new Chart(ctx, {
            type: 'line',
            data: {
              labels: ${JSON.stringify(labels)},
              datasets: [{
                label: 'Water Level (m)',
                data: ${JSON.stringify(data)},
                borderWidth: 2
              }]
            }
          });
        </script>
      </body>
      </html>
    `);

  } catch (err) {
    res.send("Error: " + err.message);
  }
});


app.get("/weekgraph", async (req, res) => {
  try {
    const today = new Date();
    const allValues = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");

      const dateStr = `${yyyy}${mm}${dd}`;

      const url = `https://www.river.go.jp/kawabou/file/files/tmlist/past/stg/${dateStr}/${OBS_ID}.json`;

      try {
        const response = await axios.get(url);
        allValues.push(...response.data);
      } catch (err) {
        console.log("skip:", dateStr);
      }
    }

    const filtered = allValues
      .filter(v => v.stg != null)
      .sort((a, b) => {
        const keyA = a.date.replaceAll("/", "") + a.time.replace(":", "");
        const keyB = b.date.replaceAll("/", "") + b.time.replace(":", "");
        return keyA.localeCompare(keyB);
      });

    const labels = filtered.map(v => v.obsTime);
    const data = filtered.map(v => v.stg);

    res.json({
      totalCount: allValues.length,
      filteredCount: filtered.length,
      first: filtered[0],
      last: filtered[filtered.length - 1]
    });

    /*
    res.send(`
      <html>
      <head>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      </head>
      <body>
        <h2>Past 7 Days Water Level</h2>
        <canvas id="chart"></canvas>
        <script>
          new Chart(document.getElementById('chart'), {
            type: 'line',
            data: {
              labels: ${JSON.stringify(labels)},
              datasets: [{
                label: 'Water Level (m)',
                data: ${JSON.stringify(data)},
                borderWidth: 2,
                tension: 0.2
              }]
            },
            options: {
              scales: {
                x: {
                  ticks: { maxTicksLimit: 20 }
                }
              }
            }
          });
        </script>
      </body>
      </html>
    `);
    */
  } catch (err) {
    res.send("Error: " + err.message);
  }
});
