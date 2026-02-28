const axios = require("axios");

async function getCurrentTime() {
  const TIME_URL = "https://www.river.go.jp/kawabou/file/system/tmCrntTime.json";
  const timeRes = await axios.get(TIME_URL);
  return timeRes.data.obsValue?.obsTime || timeRes.data.crntObsTime;
}

async function getCurrentWaterLevel(obsId) {
  try {
    const currentTime = await getCurrentTime();
    const date = currentTime.slice(0, 10).replaceAll("/", "");
    const time = currentTime.slice(11, 16).replace(":", "");
    const url = `https://www.river.go.jp/kawabou/file/files/tmlist/stg/${date}/${time}/${obsId}.json`;
    const res = await axios.get(url);
    const values = (res.data.min10Values || []).filter(v => v.stg !== null);
    return { labels: values.map(v => v.obsTime).reverse(), data: values.map(v => v.stg).reverse() };
  } catch (err) {
    console.error("getCurrentWaterLevel error:", err);
    return { labels: [], data: [] };
  }
}

async function getWeekData(obsId) {
  const today = new Date();
  const allValues = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const yyyy = d.getFullYear(), mm = String(d.getMonth()+1).padStart(2,"0"), dd = String(d.getDate()).padStart(2,"0");
    const dateStr = `${yyyy}${mm}${dd}`;
    const url = `https://www.river.go.jp/kawabou/file/files/tmlist/past/stg/${dateStr}/${obsId}.json`;
    try { const res = await axios.get(url); allValues.push(...(res.data.pastValues||[])); } catch {}
  }
  const filtered = allValues.filter(v=>v.stg!=null).sort((a,b)=> (a.date.replaceAll("/","")+a.time.replace(":","")).localeCompare(b.date.replaceAll("/","")+b.time.replace(":","")));
  return { labels: filtered.map(v=>v.obsTime), data: filtered.map(v=>v.stg) };
}

// --- モダンな両方グラフ表示 ---
function buildDoubleChartHtml(title1, labels1, data1, title2, labels2, data2, obsId) {
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
      <option value="2155500400010" ${obsId==="神通川・空港前"?"selected":""}>Sample River</option>
      <option value="2209700400001" ${obsId==="九頭竜川・五松橋"?"selected":""}>Another River</option>
    </select>

    <h2>${title1}</h2>
    <div class="chart-container"><canvas id="chart1"></canvas></div>
    <h2>${title2}</h2>
    <div class="chart-container"><canvas id="chart2"></canvas></div>

    <script>
      let chart1, chart2;

      function drawCharts(l1,d1,l2,d2){
        if(chart1) chart1.destroy();
        if(chart2) chart2.destroy();
        chart1 = new Chart(document.getElementById('chart1'), {
          type:'line', data:{ labels:l1, datasets:[{label:'Water Level (m)', data:d1, borderWidth:2, tension:0.2 }] },
          options:{ responsive:true, maintainAspectRatio:false }
        });
        chart2 = new Chart(document.getElementById('chart2'), {
          type:'line', data:{ labels:l2, datasets:[{label:'Water Level (m)', data:d2, borderWidth:2, tension:0.2 }] },
          options:{ responsive:true, maintainAspectRatio:false }
        });
      }

      document.getElementById('obsSelect').addEventListener('change', async (e)=>{
        const obs = e.target.value;
        const res = await fetch('/both?obsId=' + obs);
        const json = await res.json();
        drawCharts(json.current.labels,json.current.data,json.week.labels,json.week.data);
      });

      // 初期描画
      drawCharts(${JSON.stringify(labels1)},${JSON.stringify(data1)},${JSON.stringify(labels2)},${JSON.stringify(data2)});
    </script>
  </body>
  </html>
  `;
}

module.exports = {
  getCurrentWaterLevel,
  getWeekData,
  buildDoubleChartHtml
};
