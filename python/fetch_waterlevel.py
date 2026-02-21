import requests
from bs4 import BeautifulSoup
from datetime import datetime
import json
import os

# 水位キャッシュ保存先
CACHE_FILE = os.path.join(os.path.dirname(__file__), "waterlevel_cache.json")

URL = "https://www.river.go.jp/kawabou/pcfull/tm?itmkndCd=4&ofcCd=21555&obsCd=10&isCurrent=true&fld=0"

def fetch_water_level():
    try:
        res = requests.get(URL, timeout=10)
        soup = BeautifulSoup(res.text, "html.parser")

        container = soup.find("div", class_="tm-pc-detail-border-line pt-1")
        if not container:
            print("Water level container not found")
            return

        spans = container.find_all("span")
        data = {}
        for span in spans:
            text = span.get_text(strip=True)
            if ":" in text:
                key, value = text.split(":", 1)
                data[key] = value.strip()

        water_level = data.get("水位")
        level_num = None
        if water_level:
            try:
                level_num = float(water_level.replace("m", "").strip())
            except:
                pass

        result = {
            "level_text": water_level,
            "level_value": level_num,
            "raw_fields": data,
            "timestamp": datetime.now().isoformat()
        }

        # JSONとしてキャッシュに保存
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        print(f"[{result['timestamp']}] Water level updated: {water_level}")
    except Exception as e:
        print("Failed to fetch water level:", e)

if __name__ == "__main__":
    fetch_water_level()
