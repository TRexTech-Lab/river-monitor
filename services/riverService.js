const axios = require("axios");
const obsPoints = require("./obsPoints");

let cachedTime = null;
let cacheExpire = 0;

let waterCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分

// ==========================
// 現在時刻（キャッシュ付き）
// ==========================

async function getCurrentTime() {

  const now = Date.now();

  if (cachedTime && now < cacheExpire) {
    return cachedTime;
  }

  const TIME_URL =
    "https://www.river.go.jp/kawabou/file/system/tmCrntTime.json";

  const res = await axios.get(TIME_URL);

  cachedTime =
    res.data.obsValue?.obsTime || res.data.crntObsTime;

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
// API取得
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

  const date = currentTime.slice(0,10).replaceAll("/","");
  const time = currentTime.slice(11,16).replace(":","");

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

  const date = currentTime.slice(0,10).replaceAll("/","");
  const time = currentTime.slice(11,16).replace(":","");

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
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");

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

  return sortAndFormat(allValues,false);

}

// ==========================
// ソート
// ==========================

function sortAndFormat(values,isSixMonth){

  const sorted = [...values].sort((a,b)=>{

    const aKey =
      (a.date || "").replaceAll("/","") +
      (a.time || "").replace(":","").padStart(4,"0");

    const bKey =
      (b.date || "").replaceAll("/","") +
      (b.time || "").replace(":","").padStart(4,"0");

    return aKey.localeCompare(bKey);

  });

  const labels=[];
  const data=[];

  for(const v of sorted){

    if(!v.date) continue;

    if(isSixMonth){

      labels.push(cutDate(v.obs_time));

    }else{

      labels.push(v.obsTime || `${v.date} ${v.time}`);

    }

    data.push(normalizeStg(v));

  }

  return {labels,data};

}

// ==========================
// 全取得（並列）
// ==========================

async function getAllWaterData(obsId){

  const currentTime = await getCurrentTime();

  const [h8,d3,d7,m1,m6] = await Promise.all([

    getWaterLevel8h(obsId,currentTime),
    getWaterLevel3d(obsId,currentTime),
    getWeekData(obsId),
    getMonthData(obsId),
    getSixMonthData(obsId)

  ]);

  return {h8,d3,d7,m1,m6};

}

module.exports={
  getAllWaterData
};
