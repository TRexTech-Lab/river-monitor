onst axios = require("axios");

const OBS_ID = "2155500400010";
const TIME_URL = "https://www.river.go.jp/kawabou/file/system/tmCrntTime.json";

async function getCurrentTime() {
  const timeRes = await axios.get(TIME_URL);
  return timeRes.data.obsValue?.obsTime || timeRes.data.crntObsTime;
}

async function getCurrentWaterLevel() {
  try {
    const currentTime = await getCurrentTime();
    const date = currentTime.slice(0, 10).replaceAll("/", "");
    const time = currentTime.slice(11, 16).replace(":", "");

    const dataUrl = `https://www.river.go.jp/kawabou/file/files/tmlist/stg/${date}/${time}/${OBS_ID}.json`;
    const dataRes = await axios.get(dataUrl);

    const values = (dataRes.data.min10Values || []).filter(v => v.stg !== null);

    return {
      labels: values.map(v => v.obsTime).reverse(),
      data: values.map(v => v.stg).reverse()
    };
  } catch (err) {
    console.error("getCurrentWaterLevel error:", err);
    return { labels: [], data: [] };
  }
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
    const url = `https://www.river.go.jp/kawabou/file/files/tmlist/past/stg/${dateStr}/${OBS_ID}.json`;

    try {
      const response = await axios.get(url);
      allValues.push(...(response.data.pastValues || []));
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

function buildDoubleChartHtml(title1, labels1, data1, title2, labels2, data2) {
  return `
    <html>
      <head>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
          body { font-family: sans-serif; text-align: center; }
          h2 { font-size: 18px; margin: 20px 0 10px; }
          canvas { display: block; margin: 0 auto 40px; max-width: 90%; height: 400px; }
        </style>
      </head>
      <body>
        <h2>${title1}</h2>
        <canvas id="chart1"></canvas>
        <h2>${title2}</h2>
        <canvas id="chart2"></canvas>
        <script>
          new Chart(document.getElementById('chart1'), {
            type: 'line',
            data: {
              labels: ${JSON.stringify(labels1)},
              datasets: [{
                label: 'Water Level (m)',
                data: ${JSON.stringify(data1)},
                borderWidth: 2,
                tension: 0.2
              }]
            },
            options: { responsive: true, maintainAspectRatio: false }
          });

          new Chart(document.getElementById('chart2'), {
            type: 'line',
            data: {
              labels: ${JSON.stringify(labels2)},
              datasets: [{
                label: 'Water Level (m)',
                data: ${JSON.stringify(data2)},
                borderWidth: 2,
                tension: 0.2
              }]
            },
            options: { responsive: true, maintainAspectRatio: false }
          });
        </script>
      </body>
    </html>
  `;
}

module.exports = {
  getCurrentWaterLevel,
  getWeekData,
  buildChartHtml,
  buildDoubleChartHtml
};
