"""
Script untuk generate data dummy dari hari ini sampai akhir Desember 2026.
Data lama (2025) dihapus dan diganti sepenuhnya.
Jalankan: python backend/model/generate_dummy.py
"""
import json
import random
from datetime import date, timedelta
from pathlib import Path

random.seed(99)

ARTIFACT_PATH = Path(__file__).parent.parent / "src" / "model-data" / "xgboost_h2.json"

SKU_CONFIG = {
    "TW001": {"product_name": "Espresso Fudgy Brownies", "variant": "Small",   "stock_product_id": "TW001", "base": [15, 17]},
    "TW002": {"product_name": "Espresso Fudgy Brownies", "variant": "Large",   "stock_product_id": "TW001", "base": [4,  5]},
    "TW003": {"product_name": "Blueberry Cheese Crumble","variant": "Standard","stock_product_id": "TW003", "base": [10, 12]},
    "TW004": {"product_name": "Korean Garlic Creamcheese","variant":"Standard","stock_product_id": "TW004", "base": [10, 11]},
    "TW005": {"product_name": "Cranberry Walnut Creamcheese","variant":"Standard","stock_product_id":"TW005","base":[10, 11]},
    "TW006": {"product_name": "Dusty Choco Hazelnut",    "variant": "Standard","stock_product_id": "TW006", "base": [9,  10]},
    "TW007": {"product_name": "Paket Alit",               "variant": "Package","stock_product_id": "TW007", "base": [5,  6]},
    "TW008": {"product_name": "Salt Bread Original",     "variant": "Standard","stock_product_id": "TW008", "base": [15, 16]},
    "TW009": {"product_name": "Sei Cheese Salt Bread",   "variant": "Standard","stock_product_id": "TW009", "base": [9,  10]},
    "TW010": {"product_name": "Shokupan Loaf",           "variant": "Standard","stock_product_id": "TW010", "base": [14, 15]},
    "TW011": {"product_name": "Country Bread",           "variant": "Standard","stock_product_id": "TW011", "base": [10, 11]},
}

def noise(scale=1.5):
    return round(random.gauss(0, scale), 2)

def xgb_pred(base, t=0):
    return round(base * (1 + 0.005 * t) + noise(1.5), 2)

def sarima_pred(base, t=0):
    return round(base * (1 + 0.005 * t) + noise(1.8), 2)

def weekday_of(d):
    return d.isoweekday()  # 2=Selasa, 5=Jumat

def all_dates(start, end):
    d, result = start, []
    while d <= end:
        result.append(d)
        d += timedelta(days=1)
    return result

def main():
    data = json.loads(ARTIFACT_PATH.read_text(encoding="utf-8"))

    today = date.today()
    end_date = date(2026, 12, 31)

    print(f"Generate data dari {today} sampai {end_date}")

    dates = all_dates(today, end_date)

    # --- Rebuild daily_series (hapus data lama, isi dari hari ini) ---
    new_daily = {}
    for sku_id, cfg in SKU_CONFIG.items():
        rows = []
        for i, d in enumerate(dates):
            wd = weekday_of(d)
            base_idx = 0 if wd == 2 else 1
            base = cfg["base"][base_idx]
            xgb = xgb_pred(base, t=i)
            sar = sarima_pred(base, t=i)
            rows.append([d.isoformat(), None, xgb, sar])
        new_daily[sku_id] = rows

    data["backtest"]["daily_series"] = new_daily
    data["backtest"]["daily_from"] = today.isoformat()
    data["backtest"]["daily_to"] = end_date.isoformat()

    # --- Rebuild slot_series (Selasa & Jumat saja) ---
    slot_dates = [d for d in dates if weekday_of(d) in (2, 5)]
    new_slots = []
    for i, d in enumerate(slot_dates):
        total_xgb = sum(xgb_pred(cfg["base"][0 if weekday_of(d) == 2 else 1]) for cfg in SKU_CONFIG.values())
        total_sar = sum(sarima_pred(cfg["base"][0 if weekday_of(d) == 2 else 1]) for cfg in SKU_CONFIG.values())
        new_slots.append({
            "delivery_date": d.isoformat(),
            "actual": None,
            "XGBoost": round(total_xgb, 1),
            "SARIMA": round(total_sar, 1),
        })

    data["backtest"]["slot_series"] = new_slots
    data["backtest"]["slot_from"] = slot_dates[0].isoformat() if slot_dates else today.isoformat()
    data["backtest"]["slot_to"] = slot_dates[-1].isoformat() if slot_dates else end_date.isoformat()

    # --- Update forecast_h2 ke slot terdekat (min H-2) ---
    next_slot = None
    d = today + timedelta(days=2)
    for _ in range(14):
        if weekday_of(d) in (2, 5):
            next_slot = d
            break
        d += timedelta(days=1)

    if next_slot:
        origin = next_slot - timedelta(days=2)
        demand_by_sku = []
        stock_map = {}
        for sku_id, cfg in SKU_CONFIG.items():
            base_idx = 0 if weekday_of(next_slot) == 2 else 1
            units = round(cfg["base"][base_idx] * 1.05 + noise(1), 4)
            demand_by_sku.append({
                "sku_id": sku_id,
                "product_name": cfg["product_name"],
                "variant": cfg["variant"],
                "stock_product_id": cfg["stock_product_id"],
                "forecast_units": units,
            })
            sp = cfg["stock_product_id"]
            if sp not in stock_map:
                stock_map[sp] = {"product_name": cfg["product_name"], "sku_ids": [], "gross": 0}
            stock_map[sp]["sku_ids"].append(sku_id)
            stock_map[sp]["gross"] = round(stock_map[sp]["gross"] + units, 4)

        data["forecast_h2"] = {
            "schema_version": 1,
            "model": "XGBoost",
            "forecast_origin": origin.isoformat(),
            "target_date": next_slot.isoformat(),
            "horizon_days": 2,
            "demand_by_sku": demand_by_sku,
            "stock_by_product": [
                {"stock_product_id": sp, "product_name": v["product_name"],
                 "sku_ids": v["sku_ids"], "gross_demand_units": v["gross"]}
                for sp, v in stock_map.items()
            ],
        }
        print(f"forecast_h2: origin={origin}, target={next_slot}")

    ARTIFACT_PATH.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding="utf-8")
    print(f"✓ Artifact disimpan: {ARTIFACT_PATH}")
    print(f"  daily_series: {today} → {end_date} ({len(dates)} hari)")
    print(f"  slot_series: {len(new_slots)} slot")

if __name__ == "__main__":
    main()
