const axios = require("axios");

// --- 現在時刻取得 ---
async function getCurrentTime() {
  const TIME_URL = "https://www.river.go.jp/kawabou/file/system/tmCrntTime.json";
  const res = await axios.get(TIME_URL);
  return res.data.obsValue?.obsTime || res.data.crntObsTime;
}

// --- 10分ごとの水位 ---
async function getCurrentWaterLevel10min(obsId) {
  try {
    const currentTime = await getCurrentTime();
    const date = currentTime.slice(0, 10).replaceAll("/", "");
    const time = currentTime.slice(11, 16).replace(":", "");
    const url = `https://www.river.go.jp/kawabou/file/files/tmlist/stg/${date}/${time}/${obsId}.json`;
    const res = await axios.get(url);
    const values = (res.data.min10Values || []).map(v => {
      if (v.stg === null || v.stg === undefined || v.stg === "" || v.stg === "-") return null;
      return Number(v.stg);
    });
    return {
      labels: (res.data.min10Values || []).map(v => v.obsTime).reverse(),
      data: values.reverse()
    };
  } catch (err) {
    console.error(err);
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
    const values = (res.data.hrValues || []).map(v => {
      if (v.stg === null || v.stg === undefined || v.stg === "" || v.stg === "-") return null;
      return Number(v.stg);
    });
    return {
      labels: (res.data.hrValues || []).map(v => v.obsTime).reverse(),
      data: values.reverse()
    };
  } catch (err) {
    console.error(err);
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

  // 日付と時間でソート
  const filtered = allValues.sort((a, b) =>
    (a.date.replaceAll("/", "") + a.time.replace(":", "")).localeCompare(
      b.date.replaceAll("/", "") + b.time.replace(":", "")
    )
  );

  const data = filtered.map(v => {
    if (v.stg === null || v.stg === undefined || v.stg === "" || v.stg === "-") return null;
    return Number(v.stg);
  });

  return { labels: filtered.map(v => v.obsTime), data };
}

// --- 3枚グラフ描画 HTML ---
function buildTripleChartHtml(title10min, labels10min, data10min,
                              titleHour, labelsHour, dataHour,
                              titleWeek, labelsWeek, dataWeek,
                              obsId) {
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
      <option value="2155500400010" ${obsId==="2155500400010"?"selected":""}>神通川・空港前</option>
      <option value="2209700400001" ${obsId==="2209700400001"?"selected":""}>九頭竜川・五松橋</option>
      <option value="0537700400045" ${obsId==="0537700400045"?"selected":""}>長良川・白鳥</option>
      <option value="0563300400030" ${obsId==="0563300400030"?"selected":""}>興津川・和田島橋</option>
      <option value="0358500400018" ${obsId==="0358500400018"?"selected":""}>酒匂川・松田</option>
      <option value="0358500400001" ${obsId==="0358500400001"?"selected":""}>桂川・大月</option>
      <option value="0358500400002" ${obsId==="0358500400002"?"selected":""}>相模川・上依知</option>
      <option value="2128900400031" ${obsId==="2128900400031"?"selected":""}>利根川・前橋</option>
      <option value="2126100400019" ${obsId==="2126100400019"?"selected":""}>鬼怒川・宝積寺(下)</option>
      <option value="2127100400010" ${obsId==="2127100400010"?"selected":""}>中川・黒羽</option>
      <option value="0128100400011" ${obsId==="0128100400011"?"selected":""}>阿仁川・米内沢</option>
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
          data:{ labels:l10, datasets:[{label:'Water Level (10min) (m)', data:d10, borderWidth:2, spanGaps:false, tension:0.2}]},
          options:{ responsive:true, maintainAspectRatio:false }
        });

        chartHour = new Chart(document.getElementById('chartHour'), {
          type:'line',
          data:{ labels:lHr, datasets:[{label:'Water Level (Hour) (m)', data:dHr, borderWidth:2, spanGaps:false, tension:0.2}]},
          options:{ responsive:true, maintainAspectRatio:false }
        });

        chartWeek = new Chart(document.getElementById('chartWeek'), {
          type:'line',
          data:{ labels:lW, datasets:[{label:'Water Level (Week) (m)', data:dW, borderWidth:2, spanGaps:false, tension:0.2}]},
          options:{ responsive:true, maintainAspectRatio:false }
        });
      }

      async function fetchAllData(obsId){
        const res = await fetch('/both?obsId='+obsId+'&json=1');
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
