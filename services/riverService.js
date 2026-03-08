// services/riverService.js
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

// --- 8h: 10分単位 ---
async function getWaterLevel8h(obsId) {
  try {
    const currentTime = await getCurrentTime();
    const date = currentTime.slice(0,10).replaceAll("/","");
    const time = currentTime.slice(11,16).replace(":","");
    const url = `https://www.river.go.jp/kawabou/file/files/tmlist/stg/${date}/${time}/${obsId}.json`;
    const res = await axios.get(url);
    const raw = res.data.min10Values || [];
    return {
      labels: raw.map(v => v.obsTime).reverse(),
      data: raw.map(v => normalizeStg(v)).reverse()
    };
  } catch(err) {
    console.error("8h fetch error:", err.message);
    return { labels: [], data: [] };
  }
}

// --- 3d: 1時間単位 ---
async function getWaterLevel3d(obsId) {
  try {
    const currentTime = await getCurrentTime();
    const date = currentTime.slice(0,10).replaceAll("/","");
    const time = currentTime.slice(11,16).replace(":","");
    const url = `https://www.river.go.jp/kawabou/file/files/tmlist/stg/${date}/${time}/${obsId}.json`;
    const res = await axios.get(url);
    const raw = res.data.hrValues || [];
    return {
      labels: raw.map(v => v.obsTime).reverse(),
      data: raw.map(v => normalizeStg(v)).reverse()
    };
  } catch(err) {
    console.error("3d fetch error:", err.message);
    return { labels: [], data: [] };
  }
}

// --- 過去7日 ---
async function getWeekData(obsId) {
  const today = new Date();
  let allValues = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    const dateStr = `${yyyy}${mm}${dd}`;
    const url = `https://www.river.go.jp/kawabou/file/files/tmlist/past/stg/${dateStr}/${obsId}.json`;
    try {
      const res = await axios.get(url);
      allValues.push(...(res.data.pastValues || []));
    } catch(err) {
      console.warn("Week data fetch error:", err.message);
    }
  }
  return sortAndFormat(allValues, false);
}

// --- 共通整形 ---
function sortAndFormat(values, isSixMonth){
  const sorted = values.sort((a,b)=>{
    const aKey = (a.date||"").replaceAll("/","") + (a.time||"").replace(":","");
    const bKey = (b.date||"").replaceAll("/","") + (b.time||"").replace(":","");
    return aKey.localeCompare(bKey);
  });

  const labels = [];
  const data = [];
  for(const v of sorted){
    if(!v.date) continue;
    if(isSixMonth){
      if(v.obs_time) labels.push((v.obs_time||"").slice(0,10));
    } else {
      labels.push(v.obsTime || `${v.date} ${v.time}`);
    }
    data.push(normalizeStg(v));
  }
  return { labels, data };
}

// --- HTML生成 ---
function buildFiveChartHtml(
  title8h, labels8h, data8h,
  title3d, labels3d, data3d,
  title7d, labels7d, data7d,
  title1M, labels1M, data1M,
  title6M, labels6M, data6M,
  currentObsId
){
  const optionsHtml = obsPoints.map(p=>`<option value="${p.obs_id}" ${p.obs_id===currentObsId?"selected":""}>${p.name}</option>`).join("\n");
  return `
<html>
<head>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
body{font-family:sans-serif;text-align:center;}
h2{font-size:18px;margin:20px 0 10px;}
.chart-container{width:90%;max-width:800px;height:400px;margin:20px auto;}
canvas{width:100%!important;height:100%!important;}
select{font-size:16px;margin:10px;}
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

const monthBoundaryPlugin = {
  id: 'monthBoundary',

  afterDraw(chart) {
    const {ctx, chartArea, scales} = chart;
    const labels = chart.data.labels;

    if (!labels || labels.length === 0) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(100,100,200,1)';
    ctx.lineWidth = 2;

    for (let i = 1; i < labels.length; i++) {

      const prev = labels[i-1];
      const curr = labels[i];

      if (!prev || !curr) continue;

      const prevMonth = prev.slice(0,7);
      const currMonth = curr.slice(0,7);

      if (prevMonth !== currMonth) {

        const x = scales.x.getPixelForValue(i);

        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
};

let chart8h, chart3d, chart7d, chart1M, chart6M;

function createChart(canvasId, labels, data){
  return new Chart(document.getElementById(canvasId),{
    type:'line',
    data:{labels,datasets:[{data,borderWidth:2,tension:0.2}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}
  });
}

function createTimeChart(canvasId, labels, data) {
  const drawnDays = new Set();
  return new Chart(document.getElementById(canvasId), {
    type: 'line',
    data: { labels, datasets: [{ data, borderWidth: 2, tension: 0.2 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: {
            color: function(ctx) {
              const i = ctx.index;
              const label = labels[i];
              
              if (!label) return 'rgba(100,100,200,0.2)';
              
              const day = label.slice(0, 10); // YYYY-MM-DD部分
              const time = label.split(" ")[1];
              
              if (time === "00:00") {
                return 'rgba(100,100,200,1.0)';
              }
              return 'rgba(100,100,200,0.2)';
            },
            
            lineWidth: function(ctx) {
              const i = ctx.index;
              const label = labels[i];
              
              if (!label) return 1;
              const time = label.split(" ")[1];
              
              if (time === "00:00"){
                return 2; // 線の太さを調整したければここで変更可能
              }
              return 1;
            }
          }
        }
      }
    }
  });
}


function createMonthlyChart(canvasId, labels, data){
  return new Chart(document.getElementById(canvasId),{
    type:'line',
    data:{labels,datasets:[{data,borderWidth:2,tension:0.2}]},
    plugins:[monthBoundaryPlugin],
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        monthBoundary:{}
      },
      scales:{
        x:{
          grid:{
            color:function(ctx){
              const i = ctx.index;

             // if(i === 0){
             //   return 'rgba(100,100,200,1.0)';
             // }

              const prev = labels[i-1];
              const curr = labels[i];

              if(!prev || !curr){
                return 'rgba(100,100,200,0.2)';
              }

              const prevMonth = prev.slice(0,7);
              const currMonth = curr.slice(0,7);

              if(prevMonth !== currMonth){
                return 'rgba(100,100,200,1.0)';
              }

              return 'rgba(100,100,200,0.2)';
            },

            lineWidth:function(ctx){
              const i = ctx.index;

              //if(i === 0){
              //  return 2;
              //}

              const prev = labels[i-1];
              const curr = labels[i];

              if(!prev || !curr){
                return 1;
              }

              const prevMonth = prev.slice(0,7);
              const currMonth = curr.slice(0,7);

              if(prevMonth !== currMonth){
                return 2;
              }

              return 1;
            }
          }
        }
      }
    }
  });
}

function drawCharts(l8,d8,l3,d3,l7,d7,l1,d1,l6,d6){
  if(chart8h) chart8h.destroy();
  if(chart3d) chart3d.destroy();
  if(chart7d) chart7d.destroy();
  if(chart1M) chart1M.destroy();
  if(chart6M) chart6M.destroy();

  const l1_cut = l1.map(l=>l.slice(0,10));
  const l6_cut = l6.map(l=>l.slice(0,10));

  chart8h = createTimeChart('chart8h',l8,d8);
  chart3d = createTimeChart('chart3d',l3,d3);
  chart7d = createChart('chart7d',l7,d7);
  chart1M = createMonthlyChart('chart1M',l1_cut,d1);
  chart6M = createMonthlyChart('chart6M',l6_cut,d6);
}

async function fetchAllData(obsId){
  const res = await fetch('/waterlevel?obsId='+obsId+'&json=1');
  return await res.json();
}

const obsSelect = document.getElementById('obsSelect');
const savedObsId = localStorage.getItem('selectedObsId');
const initialObsId = savedObsId || obsSelect.value;
obsSelect.value = initialObsId;

fetchAllData(initialObsId).then(json=>{
  drawCharts(json.h8.labels,json.h8.data,json.d3.labels,json.d3.data,json.d7.labels,json.d7.data,json.m1.labels,json.m1.data,json.m6.labels,json.m6.data);
});

obsSelect.addEventListener('change',async e=>{
  const obsId = e.target.value;
  localStorage.setItem('selectedObsId',obsId);
  const json = await fetchAllData(obsId);
  drawCharts(json.h8.labels,json.h8.data,json.d3.labels,json.d3.data,json.d7.labels,json.d7.data,json.m1.labels,json.m1.data,json.m6.labels,json.m6.data);
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
  buildFiveChartHtml
};
