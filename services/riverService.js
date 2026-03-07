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

// --- 3d: 1時間単位 ---
async function getWaterLevel3d(obsId) {
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
      if (v.obs_time){
        labels.push((v.obs_time || "").slice(0,10));
      }
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
) {
  const optionsHtml = obsPoints.map(p =>
    `<option value="${p.obs_id}" ${p.obs_id===currentObsId?"selected":""}>${p.name}</option>`
  ).join("\n");

  return `
  …（HTML/Chart.js部分は省略）…
  `;
}

// --- モジュールエクスポート ---
module.exports = {
  getWaterLevel8h,
  getWaterLevel3d,
  getWeekData,
  buildFiveChartHtml
};
