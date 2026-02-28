const axios = require("axios");

const OBS_ID = "2155500400010";
const TIME_URL = "https://www.river.go.jp/kawabou/file/system/tmCrntTime.json";

async function getCurrentTime() {
  const timeRes = await axios.get(TIME_URL);
  return timeRes.data.obsValue?.obsTime || timeRes.data.crntObsTime;
}

async function getCurrentWaterLevel() {
  const currentTime = await getCurrentTime();

  const date = currentTime.slice(0, 10).replaceAll("/", "");
  const time = currentTime.slice(11, 16).replace(":", "");

  const dataUrl =
    `https://www.river.go.jp/kawabou/file/files/tmlist/stg/${date}/${time}/${OBS_ID}.json`;

  const response = await axios.get(dataUrl);
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
}

async function getWeekData() {
  const today = new Date();
  const allValues = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");

    const dateStr = `${yyyy}${mm}${dd}`;
    const url =
      `https://www.river.go.jp/kawabou/file/files/tmlist/past/stg/${dateStr}/${OBS_ID}.json`;

    try {
      const response = await axios.get(url);
      allValues.push(...response.data.pastValues);
    } catch {
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

  return {
    labels: filtered.map(v => v.obsTime),
    data: filtered.map(v => v.stg)
  };
}

function buildChartHtml(title, labels, data) {
  return `
    <html>
    <head>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body>
      <h2>${title}</h2>
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
          }
        });
      </script>
    </body>
    </html>
  `;
}

module.exports = {
  getCurrentWaterLevel,
  getWeekData,
  buildChartHtml
};
