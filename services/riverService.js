const axios = require("axios");

async function getCurrentTime() {
  const res = await axios.get(
    "https://www.river.go.jp/kawabou/file/files/master/obs/scd/current_time.json",
    { timeout: 5000 }
  );
  return res.data.now;
}

async function fetchJson(url) {
  const res = await axios.get(url, { timeout: 5000 });
  return res.data;
}

async function getWaterLevel8h(obsId, currentTime) {
  const url =
    `https://www.river.go.jp/kawabou/file/gjson/obs/${obsId}/waterlevel/8h/${currentTime}.json`;
  return fetchJson(url);
}

async function getWaterLevel3d(obsId, currentTime) {
  const url =
    `https://www.river.go.jp/kawabou/file/gjson/obs/${obsId}/waterlevel/3d/${currentTime}.json`;
  return fetchJson(url);
}

async function getWeekData(obsId) {
  const url =
    `https://www.river.go.jp/kawabou/file/gjson/obs/${obsId}/waterlevel/7d/latest.json`;
  return fetchJson(url);
}

async function getAllWaterData(obsId) {
  const currentTime = await getCurrentTime();

  const [h8, d3, d7] = await Promise.all([
    getWaterLevel8h(obsId, currentTime),
    getWaterLevel3d(obsId, currentTime),
    getWeekData(obsId)
  ]);

  return { h8, d3, d7 };
}

function buildFiveChartHtml({ h8, d3, d7, m1, m6 }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">

  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"></script>

  <style>
    canvas {
      max-width: 100%;
      margin-bottom: 40px;
    }
  </style>
</head>

<body>

  <canvas id="chart8h"></canvas>
  <canvas id="chart3d"></canvas>
  <canvas id="chart7d"></canvas>
  <canvas id="chart1m"></canvas>
  <canvas id="chart6m"></canvas>

  <script>

    function createChart(id, data) {

      new Chart(document.getElementById(id), {

        type: "line",

        data: {
          datasets: [{
            label: "水位",
            data: data,
            borderWidth: 2,
            pointRadius: 0
          }]
        },

        options: {

          animation: false,

          scales: {

            x: {
              type: "time",

              grid: {
                lineWidth: (ctx) => {

                  const d = new Date(ctx.tick.value);

                  // 月境界
                  if (d.getDate() === 1 && d.getHours() === 0) {
                    return 2.5;
                  }

                  // 日境界
                  if (d.getHours() === 0) {
                    return 1.6;
                  }

                  // 通常
                  return 0.6;
                }
              }
            },

            y: {
              beginAtZero: false
            }

          }

        }

      });

    }

    createChart("chart8h", ${JSON.stringify(h8)});
    createChart("chart3d", ${JSON.stringify(d3)});
    createChart("chart7d", ${JSON.stringify(d7)});
    createChart("chart1m", ${JSON.stringify(m1)});
    createChart("chart6m", ${JSON.stringify(m6)});

  </script>

</body>
</html>
`;
}

module.exports = {
  getAllWaterData,
  buildFiveChartHtml
};
