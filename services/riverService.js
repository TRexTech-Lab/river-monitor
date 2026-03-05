const axios = require("axios");
const obsPoints = require("./obsPoints");
const { getMonthDataFromDB, getSixMonthDataFromDB, saveHourData } = require("./supabaseService");

// --- 現在時刻取得 ---
async function getCurrentTime() {
  const TIME_URL = "https://www.river.go.jp/kawabou/file/system/tmCrntTime.json";
  const res = await axios.get(TIME_URL);
  return res.data.obsValue?.obsTime || res.data.crntObsTime;
}

// --- 水位正規化 ---
function normalizeStg(v) {
  if (!v) return null;
  if (v.stgCcd && v.stgCcd !== 0) return null;
  if (v.stg === null || v.stg === undefined) return null;
  if (v.stg === "" || v.stg === "-") return null;
  return Number(v.stg);
}

// --- 8h (10分単位) ---
async function getWaterLevel8h(obsId) {
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
    console.error("8h fetch error:", err.message);
    return { labels: [], data: [] };
  }
}

// --- 3d (1時間単位) ---
async function getWaterLevel3d(obsId) {
  try {
    const currentTime = await getCurrentTime();
    const date = currentTime.slice(0, 10).replaceAll("/", "");
    const time = currentTime.slice(11, 16).replace(":", "");
    const url = `https://www.river.go.jp/kawabou/file/files/tmlist/stg/${date}/${time}/${obsId}.json`;

    const res = await axios.get(url);
    const raw = res.data.hrValues || [];

    // 保存もここで可能（保険）
    await saveHourData(obsId, {
      labels: raw.map(v => v.obsTime),
      data: raw.map(v => normalizeStg(v))
    });

    return {
      labels: raw.map(v => v.obsTime).reverse(),
      data: raw.map(v => normalizeStg(v)).reverse()
    };
  } catch (err) {
    console.error("3d fetch error:", err.message);
    return { labels: [], data: [] };
  }
}

// --- 過去7日 ---
async function getWaterLevel7d(obsId) {
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
      console.warn("7d fetch error:", err.message);
    }
  }

  return sortAndFormat(allValues, false);
}

// --- 共通整形 ---
function sortAndFormat(values, isSixMonth) {
  const sorted = values.sort((a, b) => {
    const aKey = (a.date || "").replaceAll("/", "") + (a.time || "").replace(":", "");
    const bKey = (b.date || "").replaceAll("/", "") + (b.time || "").replace(":", "");
    return aKey.localeCompare(bKey);
  });

  const labels = [];
  const data = [];

  for (const v of sorted) {
    if (!v.date) continue;
    if (isSixMonth) {
      labels.push((v.obs_time || "").slice(0, 10));
    } else {
      labels.push(v.obsTime || `${v.date} ${v.time}`);
    }
    data.push(normalizeStg(v));
  }

  return { labels, data };
}

// --- HTML生成 (5枚グラフ対応) ---
function buildFiveChartHtml(
  title8h, labels8h, data8h,
  title3d, labels3d, data3d,
  title7d, labels7d, data7d,
  title1m, labels1m, data1m,
  title6m, labels6m, data6m,
  currentObsId
) {
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
  <label>観測ポイントを選択:</label>
  <select id="obsSelect">${optionsHtml}</select>

  <h2>${title8h}</h2>
  <div class="chart-container"><canvas id="chart8h"></canvas></div>

  <h2>${title3d}</h2>
  <div class="chart-container"><canvas id="chart3d"></canvas></div>

  <h2>${title7d}</h2>
  <div class="chart-container"><canvas id="chart7d"></canvas></div>

  <h2>${title1m}</h2>
  <div class="chart-container"><canvas id="chart1m"></canvas></div>

  <h2>${title6m}</h2>
  <div class="chart-container"><canvas id="chart6m"></canvas></div>

  <script>
    let chart8h, chart3d, chart7d, chart1m, chart6m;

    function createChart(canvasId, labels, data){
      return new Chart(document.getElementById(canvasId), {
        type:'line',
        data:{ labels, datasets:[{ data, borderWidth:2, tension:0.2 }] },
        options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } } }
      });
    }

    function drawCharts(l8,d8,l3,d3,l7,d7,l1,d1,l6,d6){
      if(chart8h) chart8h.destroy();
      if(chart3d) chart3d.destroy();
      if(chart7d) chart7d.destroy();
      if(chart1m) chart1m.destroy();
      if(chart6m) chart6m.destroy();

      chart8h = createChart('chart8h', l8, d8);
      chart3d = createChart('chart3d', l3, d3);
      chart7d = createChart('chart7d', l7, d7);
      chart1m = createChart('chart1m', l1, d1);

      const ctx6 = document.getElementById('chart6m').getContext('2d');
      chart6m = new Chart(ctx6, {
        type: 'line',
        data: { labels: l6.map(l=>l.slice(0,10)), datasets:[{ data:d6, borderWidth:2, tension:0.2, borderColor:'blue', backgroundColor:'rgba(0,0,255,0.1)', fill:true }] },
        options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } } }
      });
    }

    async function fetchAllData(obsId){
      const res = await fetch('/waterlevel?obsId=' + obsId + '&json=1');
      return await res.json();
    }

    const obsSelect = document.getElementById('obsSelect');
    const savedObsId = localStorage.getItem('selectedObsId');
    const initialObsId = savedObsId || obsSelect.value;
    obsSelect.value = initialObsId;

    fetchAllData(initialObsId).then(json => {
      drawCharts(
        json.h8.labels, json.h8.data,
        json.d3.labels, json.d3.data,
        json.d7.labels, json.d7.data,
        json.m1.labels, json.m1.data,
        json.m6.labels, json.m6.data
      );
    });

    obsSelect.addEventListener('change', async (e)=>{
      const obsId = e.target.value;
      localStorage.setItem('selectedObsId', obsId);
      const json = await fetchAllData(obsId);
      drawCharts(
        json.h8.labels, json.h8.data,
        json.d3.labels, json.d3.data,
        json.d7.labels, json.d7.data,
        json.m1.labels, json.m1.data,
        json.m6.labels, json.m6.data
      );
    });
  </script>
</body>
</html>
`;
}

module.exports = {
  getWaterLevel8h,
  getWaterLevel3d,
  getWaterLevel7d,
  getMonthDataFromDB,
  getSixMonthDataFromDB,
  buildFiveChartHtml
};
