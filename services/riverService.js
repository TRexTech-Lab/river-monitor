const axios = require("axios");
const obsPoints = require("./obsPoints");

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

// --- ラベル安全カット ---
function cutDate(label) {
  if (!label) return "";
  return String(label).substring(0, 10);
}

// --- 共通整形 ---
function sortAndFormat(values, isSixMonth) {
  const sorted = [...values].sort((a, b) => {
    const aKey = (a.date || "").replaceAll("/", "") + (a.time || "").replace(":", "");
    const bKey = (b.date || "").replaceAll("/", "") + (b.time || "").replace(":", "");
    return aKey.localeCompare(bKey);
  });

  const labels = [];
  const data = [];

  for (const v of sorted) {
    if (!v.date && !v.obs_time) continue;

    if (isSixMonth) {
      if (v.obs_time) labels.push(cutDate(v.obs_time));
    } else {
      labels.push(v.obsTime || `${v.date} ${v.time}`);
    }

    data.push(normalizeStg(v));
  }

  return { labels, data };
}

// --- 8h: 10分単位 ---
async function getWaterLevel8h(obsId) {
  if (!obsId) return { labels: [], data: [] };
  try {
    const currentTime = await getCurrentTime();
    const date = currentTime.slice(0, 10).replaceAll("/", "");
    const time = currentTime.slice(11, 16).replace(":", "");
    const url = `https://www.river.go.jp/kawabou/file/files/tmlist/stg/${date}/${time}/${obsId}.json`;
    const res = await axios.get(url);
    const raw = res.data.min10Values || [];
    return { labels: raw.map(v => v.obsTime).reverse(), data: raw.map(v => normalizeStg(v)).reverse() };
  } catch {
    return { labels: [], data: [] };
  }
}

// --- 3d: 1時間単位 ---
async function getWaterLevel3d(obsId) {
  if (!obsId) return { labels: [], data: [] };
  try {
    const currentTime = await getCurrentTime();
    const date = currentTime.slice(0, 10).replaceAll("/", "");
    const time = currentTime.slice(11, 16).replace(":", "");
    const url = `https://www.river.go.jp/kawabou/file/files/tmlist/stg/${date}/${time}/${obsId}.json`;
    const res = await axios.get(url);
    const raw = res.data.hrValues || [];
    return { labels: raw.map(v => v.obsTime).reverse(), data: raw.map(v => normalizeStg(v)).reverse() };
  } catch {
    return { labels: [], data: [] };
  }
}

// --- 過去7日 ---
async function getWeekData(obsId) {
  if (!obsId) return { labels: [], data: [] };
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
    } catch {}
  }
  return sortAndFormat(allValues, false);
}

// --- 全データ取得（Monthly用も作る） ---
async function getAllWaterData(obsId) {
  const h8 = await getWaterLevel8h(obsId);
  const d3 = await getWaterLevel3d(obsId);
  const d7 = await getWeekData(obsId);

  // Monthlyサンプルデータ（実データが必要ならここを変更）
  const today = new Date();
  const m1Values = [];
  const m6Values = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today);
    d.setMonth(today.getMonth() - i);
    const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    m6Values.push({ obs_time: label, stg: Math.random() * 5 + 1 });
    if (i === 0) m1Values.push({ obs_time: label, stg: Math.random() * 5 + 1 });
  }
  const m1 = sortAndFormat(m1Values, true);
  const m6 = sortAndFormat(m6Values, true);

  return { h8, d3, d7, m1, m6 };
}

// --- HTML生成 ---
function buildFiveChartHtml(
  title8h, labels8h, data8h,
  title3d, labels3d, data3d,
  title7d, labels7d, data7d,
  title1M, labels1M, data1M,
  title6M, labels6M, data6M,
  currentObsId
) {
  const optionsHtml = obsPoints
    .map(p => `<option value="${p.obs_id}" ${p.obs_id === currentObsId ? "selected" : ""}>${p.name}</option>`)
    .join("\n");

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

<h2>${title8h}</h2><div class="chart-container"><canvas id="chart8h"></canvas></div>
<h2>${title3d}</h2><div class="chart-container"><canvas id="chart3d"></canvas></div>
<h2>${title7d}</h2><div class="chart-container"><canvas id="chart7d"></canvas></div>
<h2>${title1M}</h2><div class="chart-container"><canvas id="chart1M"></canvas></div>
<h2>${title6M}</h2><div class="chart-container"><canvas id="chart6M"></canvas></div>

<script>
let chart8h, chart3d, chart7d, chart1M, chart6M;

const monthBoundaryPlugin = {
  id: 'monthBoundary',
  afterDraw(chart) {
    const { ctx, chartArea } = chart;
    const labels = chart.data.labels;
    if (!labels || labels.length === 0) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(100,100,100,1)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < labels.length; i++) {
      const prev = labels[i-1], curr = labels[i];
      if (!prev || !curr) continue;
      if (prev.slice(0,7) !== curr.slice(0,7)) {
        const x = chart.getDatasetMeta(0).data[i].x;
        ctx.beginPath(); ctx.moveTo(x, chartArea.top); ctx.lineTo(x, chartArea.bottom); ctx.stroke();
      }
    }
    ctx.restore();
  }
};

function createChart(canvasId, labels, data, plugins = []) {
  return new Chart(document.getElementById(canvasId), {
    type: 'line',
    data: { labels, datasets: [{ data, borderWidth: 2, tension: 0.2 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    plugins
  });
}

async function fetchAndDraw(obsId) {
  const res = await fetch('/waterlevel?obsId=' + obsId + '&json=1');
  const json = await res.json();
  if(chart8h) chart8h.destroy();
  if(chart3d) chart3d.destroy();
  if(chart7d) chart7d.destroy();
  if(chart1M) chart1M.destroy();
  if(chart6M) chart6M.destroy();
  chart8h = createChart('chart8h', json.h8.labels, json.h8.data);
  chart3d = createChart('chart3d', json.d3.labels, json.d3.data);
  chart7d = createChart('chart7d', json.d7.labels, json.d7.data);

  // Monthlyグラフはラベルを日付だけにカット
  const m1Labels = json.m1.labels.map(l => l.slice(0,10));
  const m6Labels = json.m6.labels.map(l => l.slice(0,10));
  
  chart1M = createChart('chart1M', json.m1.labels, json.m1.data, [monthBoundaryPlugin]);
  chart6M = createChart('chart6M', json.m6.labels, json.m6.data, [monthBoundaryPlugin]);
}

const obsSelect = document.getElementById('obsSelect');
const savedObsId = localStorage.getItem('selectedObsId');
const initialObsId = savedObsId || obsSelect.value;
obsSelect.value = initialObsId;
fetchAndDraw(initialObsId);
obsSelect.addEventListener('change', e => {
  localStorage.setItem('selectedObsId', e.target.value);
  fetchAndDraw(e.target.value);
});

</script>
</body>
</html>
`;
}

module.exports = {
  getWaterLevel8h,
  getWaterLevel3d,
  getWeekData,
  getAllWaterData,
  buildFiveChartHtml
};
