const axios = require("axios");
const obsPoints = require("./obsPoints");

// --- 現在時刻取得 ---
async function getCurrentTime() {
  const TIME_URL = "https://www.river.go.jp/kawabou/file/system/tmCrntTime.json";
  const res = await axios.get(TIME_URL);
  return res.data.obsValue?.obsTime || res.data.crntObsTime;
}

// --- 水位の正規化（欠測処理の統一） ---
function normalizeStg(v) {
  if (!v) return null;
  if (v.stgCcd && v.stgCcd !== 0) return null;
  if (v.stg === null || v.stg === undefined) return null;
  if (v.stg === "" || v.stg === "-") return null;
  return Number(v.stg);
}

// --- 10分ごとの水位 ---
async function getCurrentWaterLevel10min(obsId) {
  try {
    const currentTime = await getCurrentTime();
    const date = currentTime.slice(0, 10).replaceAll("/", "");
    const time = currentTime.slice(11, 16).replace(":", "");
    const url = `https://www.river.go.jp/kawabou/file/files/tmlist/stg/${date}/${time}/${obsId}.json`;
    const res = await axios.get(url);
    const raw = res.data.min10Values || [];
    return {
      labels: raw.map(v => v.obsTime).reverse(),
      data: raw.map(v => normalizeStg(v)).reverse()
    };
  } catch (err) {
    console.error("10min fetch error:", err.message);
    return { labels: [], data: [] };
  }
}

// --- 1時間ごとの水位 ---
async function getCurrentWaterLevelHour(obsId) {
  try {
    const currentTime = await getCurrentTime();
    const date = currentTime.slice(0, 10).replaceAll("/", "");
    const time = currentTime.slice(11, 16).replace(":", "");
    const url = `https://www.river.go.jp/kawabou/file/files/tmlist/stg/${date}/${time}/${obsId}.json`;
    const res = await axios.get(url);
    const raw = res.data.hrValues || [];
    return {
      labels: raw.map(v => v.obsTime).reverse(),
      data: raw.map(v => normalizeStg(v)).reverse()
    };
  } catch (err) {
    console.error("Hour fetch error:", err.message);
    return { labels: [], data: [] };
  }
}

// --- 過去7日分 ---
async function getWeekData(obsId) {
  const today = new Date();
  let allValues = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}${mm}${dd}`;
    const url = `https://www.river.go.jp/kawabou/file/files/tmlist/past/stg/${dateStr}/${obsId}.json`;

    try {
      const res = await axios.get(url);
      allValues.push(...(res.data.pastValues || []));
    } catch (err) {
      console.warn("Week data fetch error:", err.message);
    }
  }

  const sorted = allValues.sort((a, b) => {
    const aKey = (a.date || "").replaceAll("/", "") + (a.time || "").replace(":", "");
    const bKey = (b.date || "").replaceAll("/", "") + (b.time || "").replace(":", "");
    return aKey.localeCompare(bKey);
  });

  const labels = [];
  const data = [];

  for (const v of sorted) {
    const label = v.obsTime || `${v.date} ${v.time}`;
    labels.push(label);
    if (!v || v.stg === null || v.stg === undefined || v.stg === "" || v.stg === "-" || (v.stgCcd && v.stgCcd !== 0)) {
      data.push(null);
      continue;
    }
    data.push(Number(v.stg));
  }

  return { labels, data };
}

// --- 3枚グラフ描画 HTML ---
function buildTripleChartHtml(title10min, labels10min, data10min,
                              titleHour, labelsHour, dataHour,
                              titleWeek, labelsWeek, dataWeek,
                              currentObsId) {

  // <select>のoptionを動的に作る
  const optionsHtml = obsPoints.map(p =>
    `<option value="${p.obs_id}" ${p.obs_id===currentObsId?"selected":""}>${p.name}</option>`
  ).join("\n");

  return `
  <html>
  <head>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
      body { font-family: sans-serif; text-align: center; }
      h2 { font-size: 18px; margin: 20px 0 10px; }
      .chart-container { width: 90%; max-width: 800px; height: 400px; margin: 20px auto; }
      canvas { width: 100% !important; height: 100% !important; }
      select { font-size: 16px; margin: 10px; }
    </style>
  </head>
  <body>
    <label for="obsSelect">観測ポイントを選択:</label>
    <select id="obsSelect">
      ${optionsHtml}
    </select>

    <h2>${title10min}</h2>
    <div class="chart-container"><canvas id="chart10min"></canvas></div>
    <h2>${titleHour}</h2>
    <div class="chart-container"><canvas id="chartHour"></canvas></div>
    <h2>${titleWeek}</h2>
    <div class="chart-container"><canvas id="chartWeek"></canvas></div>

    <script>
      let chart10min, chartHour, chartWeek;

      function drawCharts(l10,d10,lHr,dHr,lW,dW){
        if(chart10min) chart10min.destroy();
        if(chartHour) chartHour.destroy();
        if(chartWeek) chartWeek.destroy();

        chart10min = new Chart(document.getElementById('chart10min'), {
          type:'line',
          data:{ labels:l10, datasets:[{data:d10, borderWidth:2, spanGaps:false, tension:0.2}]},
          options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} }
        });

        chartHour = new Chart(document.getElementById('chartHour'), {
          type:'line',
          data:{ labels:lHr, datasets:[{data:dHr, borderWidth:2, spanGaps:false, tension:0.2}]},
          options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} }
        });

        chartWeek = new Chart(document.getElementById('chartWeek'), {
          type:'line',
          data:{ labels:lW, datasets:[{data:dW, borderWidth:2, spanGaps:false, tension:0.2}]},
          options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} }
        });
      }

      async function fetchAllData(obsId){
        const res = await fetch('/waterlevel?obsId='+obsId+'&json=1');
        const json = await res.json();
        return { current10min: json.current10min, currentHour: json.currentHour, week: json.week };
      }

      document.getElementById('obsSelect').addEventListener('change', async (e)=>{
        const obs = e.target.value;
        const json = await fetchAllData(obs);
        drawCharts(json.current10min.labels,json.current10min.data,
                   json.currentHour.labels,json.currentHour.data,
                   json.week.labels,json.week.data);
      });

      // 初期描画
      drawCharts(${JSON.stringify(labels10min)}, ${JSON.stringify(data10min)},
                 ${JSON.stringify(labelsHour)}, ${JSON.stringify(dataHour)},
                 ${JSON.stringify(labelsWeek)}, ${JSON.stringify(dataWeek)});
    </script>
  </body>
  </html>
  `;
}

module.exports = {
  getCurrentWaterLevel10min,
  getCurrentWaterLevelHour,
  getWeekData,
  buildTripleChartHtml
};
