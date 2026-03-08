const axios = require("axios");
const obsPoints = require("./obsPoints");

let cachedTime = null;
let cacheExpire = 0;

let waterCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;


// ==========================
// 現在時刻（キャッシュ）
// ==========================

async function getCurrentTime() {

  const now = Date.now();

  if (cachedTime && now < cacheExpire) {
    return cachedTime;
  }

  const url =
    "https://www.river.go.jp/kawabou/file/system/tmCrntTime.json";

  const res = await axios.get(url);

  cachedTime =
    res.data.obsValue?.obsTime ||
    res.data.crntObsTime;

  cacheExpire = now + 60000;

  return cachedTime;

}


// ==========================
// 水位正規化
// ==========================

function normalizeStg(v) {

  if (v == null) return null;

  if (v.stgCcd && v.stgCcd !== 0) return null;

  if (v.stg === "" || v.stg === "-") return null;

  if (v.stg === null || v.stg === undefined) return null;

  return Number(v.stg);

}


// ==========================
// ラベルカット
// ==========================

function cutDate(label) {

  if (!label) return "";

  return String(label).substring(0, 10);

}


// ==========================
// river API取得（キャッシュ）
// ==========================

async function fetchRiverJson(url) {

  const cached = waterCache.get(url);

  if (cached && Date.now() < cached.expire) {
    return cached.data;
  }

  const res = await axios.get(url);

  waterCache.set(url, {
    data: res.data,
    expire: Date.now() + CACHE_TTL
  });

  return res.data;

}


// ==========================
// 8時間
// ==========================

async function getWaterLevel8h(obsId, currentTime) {

  const date = currentTime.slice(0, 10).replaceAll("/", "");
  const time = currentTime.slice(11, 16).replace(":", "");

  const url =
    `https://www.river.go.jp/kawabou/file/files/tmlist/stg/${date}/${time}/${obsId}.json`;

  const res = await fetchRiverJson(url);

  const raw = res.min10Values || [];

  return {
    labels: raw.map(v => v.obsTime).reverse(),
    data: raw.map(v => normalizeStg(v)).reverse()
  };

}


// ==========================
// 3日
// ==========================

async function getWaterLevel3d(obsId, currentTime) {

  const date = currentTime.slice(0, 10).replaceAll("/", "");
  const time = currentTime.slice(11, 16).replace(":", "");

  const url =
    `https://www.river.go.jp/kawabou/file/files/tmlist/stg/${date}/${time}/${obsId}.json`;

  const res = await fetchRiverJson(url);

  const raw = res.hrValues || [];

  return {
    labels: raw.map(v => v.obsTime).reverse(),
    data: raw.map(v => normalizeStg(v)).reverse()
  };

}


// ==========================
// 7日
// ==========================

async function getWeekData(obsId) {

  const today = new Date();

  let allValues = [];
  const requests = [];

  for (let i = 0; i < 7; i++) {

    const d = new Date(today);
    d.setDate(today.getDate() - i);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");

    const dateStr = `${yyyy}${mm}${dd}`;

    const url =
      `https://www.river.go.jp/kawabou/file/files/tmlist/past/stg/${dateStr}/${obsId}.json`;

    requests.push(fetchRiverJson(url));

  }

  const results = await Promise.allSettled(requests);

  for (const r of results) {

    if (r.status === "fulfilled") {
      allValues.push(...(r.value.pastValues || []));
    }

  }

  return sortAndFormat(allValues, false);

}


// ==========================
// データ整形
// ==========================

function sortAndFormat(values, isSixMonth) {

  const sorted = [...values].sort((a, b) => {

    const aKey =
      (a.date || "").replaceAll("/", "") +
      (a.time || "").replace(":", "").padStart(4, "0");

    const bKey =
      (b.date || "").replaceAll("/", "") +
      (b.time || "").replace(":", "").padStart(4, "0");

    return aKey.localeCompare(bKey);

  });

  const labels = [];
  const data = [];

  for (const v of sorted) {

    if (!v.date) continue;

    if (isSixMonth) {
      labels.push(cutDate(v.obs_time));
    } else {
      labels.push(v.obsTime || `${v.date} ${v.time}`);
    }

    data.push(normalizeStg(v));

  }

  return { labels, data };

}


// ==========================
// 全取得
// ==========================

async function getAllWaterData(obsId) {

  const currentTime = await getCurrentTime();

  const [h8, d3, d7] = await Promise.all([
    getWaterLevel8h(obsId, currentTime),
    getWaterLevel3d(obsId, currentTime),
    getWeekData(obsId)
  ]);

  return { h8, d3, d7 };

}


// ==========================
// HTML生成
// ==========================

function buildFiveChartHtml(
  title8h, labels8h, data8h,
  title3d, labels3d, data3d,
  title7d, labels7d, data7d,
  title1M, labels1M, data1M,
  title6M, labels6M, data6M,
  currentObsId
) {

  const optionsHtml = obsPoints
    .map(p =>
      `<option value="${p.obs_id}" ${p.obs_id === currentObsId ? "selected" : ""}>${p.name}</option>`
    )
    .join("");

  return `
<html>
<head>

<meta charset="utf-8">

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<style>

body {
  font-family: sans-serif;
  text-align: center;
}

.chart-container {
  width: 90%;
  max-width: 800px;
  height: 400px;
  margin: 20px auto;
}

canvas {
  width: 100% !important;
  height: 100% !important;
}

select {
  font-size: 16px;
  margin: 10px;
}

</style>

</head>

<body>

<label>観測ポイント</label>

<select id="obsSelect">
${optionsHtml}
</select>

<h2>${title8h}</h2>
<div class="chart-container"><canvas id="chart8h"></canvas></div>

<h2>${title3d}</h2>
<div class="chart-container"><canvas id="chart3d"></canvas></div>

<h2>${title7d}</h2>
<div class="chart-container"><canvas id="chart7d"></canvas></div>

<h2>${title1M}</h2>
<div class="chart-container"><canvas id="chart1M"></canvas></div>

<h2>${title6M}</h2>
<div class="chart-container"><canvas id="chart6M"></canvas></div>

<script>

let chart8h, chart3d, chart7d, chart1M, chart6M;

function createChart(id, labels, data) {

  return new Chart(document.getElementById(id), {

    type: "line",

    data: {
      labels: labels,
      datasets: [{
        data: data,
        borderWidth: 2,
        tension: 0.2,
        pointRadius: 0
      }]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      }
    }

  });

}

function drawCharts(l8, d8, l3, d3, l7, d7, l1, d1, l6, d6) {

  chart8h?.destroy();
  chart3d?.destroy();
  chart7d?.destroy();
  chart1M?.destroy();
  chart6M?.destroy();

  chart8h = createChart("chart8h", l8, d8);
  chart3d = createChart("chart3d", l3, d3);
  chart7d = createChart("chart7d", l7, d7);
  chart1M = createChart("chart1M", l1, d1);
  chart6M = createChart("chart6M", l6, d6);

}

async function fetchAllData(obsId) {

  const res = await fetch("/waterlevel?obsId=" + obsId + "&json=1");
  return await res.json();

}

const obsSelect = document.getElementById("obsSelect");

const savedObsId = localStorage.getItem("selectedObsId");
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

obsSelect.addEventListener("change", async e => {

  const obsId = e.target.value;

  localStorage.setItem("selectedObsId", obsId);

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


// ==========================
// export
// ==========================

module.exports = {
  getAllWaterData,
  buildFiveChartHtml
};
