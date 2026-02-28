const axios = require("axios");

// --- 現在時刻取得 ---
async function getCurrentTime() {
  const TIME_URL = "https://www.river.go.jp/kawabou/file/system/tmCrntTime.json";
  const res = await axios.get(TIME_URL);
  return res.data.obsValue?.obsTime || res.data.crntObsTime;
}

// --- 現在の水位（10分間隔） ---
async function getCurrentWaterLevel10min(obsId) {
  try {
    const currentTime = await getCurrentTime();
    const date = currentTime.slice(0, 10).replaceAll("/", "");
    const time = currentTime.slice(11, 16).replace(":", "");
    const url = `https://www.river.go.jp/kawabou/file/files/tmlist/stg/${date}/${time}/${obsId}.json`;
    const res = await axios.get(url);
    const values = res.data.min10Values || [];
    return {
      labels: values.map(v => v.obsTime || ""),
      data: values.map(v => v.stg != null ? v.stg : null) // nullで欠損表示
    };
  } catch (err) {
    console.error(err);
    return { labels: [], data: [] };
  }
}

// --- 現在の水位（時間間隔） ---
async function getCurrentWaterLevelHour(obsId) {
  try {
    const currentTime = await getCurrentTime();
    const date = currentTime.slice(0, 10).replaceAll("/", "");
    const time = currentTime.slice(11, 16).replace(":", "");
    const url = `https://www.river.go.jp/kawabou/file/files/tmlist/stg/${date}/${time}/${obsId}.json`;
    const res = await axios.get(url);
    const values = res.data.hrValues || [];
    return {
      labels: values.map(v => v.obsTime || ""),
      data: values.map(v => v.stg != null ? v.stg : null)
    };
  } catch (err) {
    console.error(err);
    return { labels: [], data: [] };
  }
}

// --- 過去7日分データ ---
async function getWeekData(obsId) {
  const today = new Date();
  const allValues = [];
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

  // 日付順にソート
  const filtered = allValues
    .sort((a, b) =>
      (a.date.replaceAll("/", "") + a.time.replace(":", ""))
        .localeCompare(b.date.replaceAll("/", "") + b.time.replace(":", ""))
    );

  return {
    labels: filtered.map(v => v.obsTime || ""),
    data: filtered.map(v => v.stg != null ? v.stg : null)
  };
}

// --- 両方のグラフ表示（HTML） ---
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

    <h2>${title1}</h2>
    <div class="chart-container"><canvas id="chart1"></canvas></div>
    <h2>${title2}</h2>
    <div class="chart-container"><canvas id="chart2"></canvas></div>

    <script>
      let chart1, chart2;

      async function fetchBothData(obsId){
        const res = await fetch('/both?obsId=' + obsId + '&json=1');
        return await res.json();
      }

      function drawCharts(l1,d1,l2,d2){
        if(chart1) chart1.destroy();
        if(chart2) chart2.destroy();
        chart1 = new Chart(document.getElementById('chart1'), {
          type:'line',
          data:{
            labels:l1,
            datasets:[{label:'Water Level (m)', 
            data:d1, 
            borderWidth:2, 
            tension:0.2,
            spanGaps: false
            }]
          }, options:{ responsive:true, maintainAspectRatio:false } 
        });
            
        chart2 = new Chart(document.getElementById('chart2'), {
          type:'line', 
          data:{ 
            labels:l2,
            datasets:[{label:'Water Level (m)',
            data:d2,
            borderWidth:2,
            tension:0.2,
            spanGaps: false
            }]
          },
          options:{ responsive:true, maintainAspectRatio:false } 
        });
      }

      document.getElementById('obsSelect').addEventListener('change', async (e)=>{
        const obs = e.target.value;
        const json = await fetchBothData(obs);
        drawCharts(json.current10min.labels, json.current10min.data, json.week.labels, json.week.data);
      });

      // 初期描画
      drawCharts(${JSON.stringify(labels1)}, ${JSON.stringify(data1)}, ${JSON.stringify(labels2)}, ${JSON.stringify(data2)});
    </script>
  </body>
  </html>
  `;
}

module.exports = { 
  getCurrentWaterLevel10min, 
  getCurrentWaterLevelHour, 
  getWeekData,
  buildDoubleChartHtml
};
