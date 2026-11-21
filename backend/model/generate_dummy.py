"""
Script untuk generate data dummy 1 bulan ke depan dan update xgboost_h2.json.
Jalankan: python backend/model/generate_dummy.py
"""
import json
import random
import math
from datetime import date, timedelta
from pathlib import Path

random.seed(99)

ARTIFACT_PATH = Path(__file__).parent.parent / "src" / "model-data" / "xgboost_h2.json"

# SKU config: base demand per hari (Selasa, Jumat) + noise
SKU_CONFIG = {
    "TW001": {"product_name": "Espresso Fudgy Brownies", "variant": "Small",  "stock_product_id": "TW001", "base": [15, 17]},
    "TW002": {"product_name": "Espresso Fudgy Brownies", "variant": "Large",  "stock_product_id": "TW001", "base": [4,  5]},
    "TW003": {"product_name": "Blueberry Cheese Crumble","variant": "Standard","stock_product_id": "TW003", "base": [10, 12]},
    "TW004": {"product_name": "Korean Garlic Creamcheese","variant":"Standard","stock_product_id": "TW004", "base": [10, 11]},
    "TW005": {"product_name": "Cranberry Walnut Creamcheese","variant":"Standard","stock_product_id":"TW005","base":[10, 11]},
    "TW006": {"product_name": "Dusty Choco Hazelnut",   "variant": "Standard","stock_product_id": "TW006", "base": [9,  10]},
    "TW007": {"product_name": "Paket Alit",              "variant": "Package", "stock_product_id": "TW007", "base": [5,  6]},
    "TW008": {"product_name": "Salt Bread Original",     "variant": "Standard","stock_product_id": "TW008", "base": [15, 16]},
    "TW009": {"product_name": "Sei Cheese Salt Bread",   "variant": "Standard","stock_product_id": "TW009", "base": [9,  10]},
    "TW010": {"product_name": "Shokupan Loaf",           "variant": "Standard","stock_product_id": "TW010", "base": [14, 15]},
    "TW011": {"product_name": "Country Bread",           "variant": "Standard","stock_product_id": "TW011", "base": [10, 11]},
}

def noise(scale=3):
    return round(random.gauss(0, scale), 2)

def xgb_pred(base, trend=0.01, t=0):
    return round(base * (1 + trend * t) + noise(1.5), 2)

def sarima_pred(base, trend=0.01, t=0):
    return round(base * (1 + trend * t) + noise(1.8), 2)

def weekday_of(d):
    return d.isoweekday()  # 1=Mon, 2=Tue, 5=Fri

def next_tuesday_friday(start):
    """Generate Selasa dan Jumat dari start date"""
    d = start
    results = []
    while True:
        wd = weekday_of(d)
        if wd in (2, 5):
            results.append(d)
        d += timedelta(days=1)
        if len(results) >= 60:
            break
    return results

def main():
    # Load artifact
    data = json.loads(ARTIFACT_PATH.read_text(encoding="utf-8"))

    today = date.today()
    # Extend daily series 1 bulan ke depan
    extend_from = today
    extend_to = today + timedelta(days=35)

    print(f"Extending data dari {extend_from} sampai {extend_to}")

    # Generate tanggal baru (semua hari, bukan hanya Sel/Jum)
    new_dates = []
    d = extend_from
    while d <= extend_to:
        new_dates.append(d)
        d += timedelta(days=1)

    t_offset = 60  # offset tren dari data lama

    for sku_id, cfg in SKU_CONFIG.items():
        existing = data["backtest"]["daily_series"].get(sku_id, [])
        existing_dates = {row[0] for row in existing}

        for i, d in enumerate(new_dates):
            ds = d.isoformat()
            if ds in existing_dates:
                continue
            wd = weekday_of(d)
            base_idx = 0 if wd == 2 else 1
            base = cfg["base"][base_idx]
            t = t_offset + i

            # Tanggal masa depan: actual = null, hanya prediksi
            xgb = xgb_pred(base, t=t)
            sar = sarima_pred(base, t=t)
            existing.append([ds, None, xgb, sar])

        # Sort berdasarkan tanggal
        existing.sort(key=lambda r: r[0])
        data["backtest"]["daily_series"][sku_id] = existing

    # Update daily_to
    data["backtest"]["daily_to"] = extend_to.isoformat()

    # Tambah slot_series untuk Selasa/Jumat 1 bulan ke depan
    existing_slot_dates = {s["delivery_date"] for s in data["backtest"]["slot_series"]}
    slot_dates = [d for d in new_dates if weekday_of(d) in (2, 5)]

    for d in slot_dates:
        ds = d.isoformat()
        if ds in existing_slot_dates:
            continue
        # Total prediksi semua SKU
        total_xgb = 0
        total_sar = 0
        for sku_id, cfg in SKU_CONFIG.items():
            wd = weekday_of(d)
            base_idx = 0 if wd == 2 else 1
            base = cfg["base"][base_idx]
            total_xgb += xgb_pred(base)
            total_sar += sarima_pred(base)

        data["backtest"]["slot_series"].append({
            "delivery_date": ds,
            "actual": None,  # belum ada aktual
            "XGBoost": round(total_xgb, 1),
            "SARIMA": round(total_sar, 1),
        })

    # Sort slot_series berdasarkan tanggal
    data["backtest"]["slot_series"].sort(key=lambda s: s["delivery_date"])

    # Update slot_to
    if slot_dates:
        data["backtest"]["slot_to"] = slot_dates[-1].isoformat()

    # Update forecast_h2 ke slot Selasa/Jumat terdekat dari hari ini
    next_slot = None
    d = today + timedelta(days=2)  # H-2
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
            wd = weekday_of(next_slot)
            base_idx = 0 if wd == 2 else 1
            base = cfg["base"][base_idx]
            units = round(base * 1.05 + noise(1), 4)
            demand_by_sku.append({
                "sku_id": sku_id,
                "product_name": cfg["product_name"],
                "variant": cfg["variant"],
                "stock_product_id": cfg["stock_product_id"],
                "forecast_units": units,
            })
            sp = cfg["stock_product_id"]
            stock_map[sp] = stock_map.get(sp, {"product_name": cfg["product_name"], "sku_ids": [], "gross": 0})
            stock_map[sp]["sku_ids"].append(sku_id)
            stock_map[sp]["gross"] = round(stock_map[sp]["gross"] + units, 4)

        stock_by_product = [
            {"stock_product_id": sp, "product_name": v["product_name"],
             "sku_ids": v["sku_ids"], "gross_demand_units": v["gross"]}
            for sp, v in stock_map.items()
        ]

        data["forecast_h2"] = {
            "schema_version": 1,
            "model": "XGBoost",
            "forecast_origin": origin.isoformat(),
            "target_date": next_slot.isoformat(),
            "horizon_days": 2,
            "demand_by_sku": demand_by_sku,
            "stock_by_product": stock_by_product,
        }
        print(f"forecast_h2 diupdate: origin={origin}, target={next_slot}")

    # Simpan
    ARTIFACT_PATH.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding="utf-8")
    print(f"✓ Artifact diupdate: {ARTIFACT_PATH}")
    print(f"  daily_series extended to: {data['backtest']['daily_to']}")
    print(f"  slot_series count: {len(data['backtest']['slot_series'])}")

if __name__ == "__main__":
    main()
