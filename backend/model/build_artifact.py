"""
Bangun artefak model untuk tab Statistik dari hasil ekspor notebook.

Pemakaian:
    python model/build_artifact.py <folder_ekspor_notebook> [--out src/model-data/xgboost_h2.json]

Folder ekspor harus berisi:
    backtest_demand_per_sku.csv, backtest_slot_pengiriman_simulasi.csv,
    forecast_h2.json, forecast_slot_demo.json

Jalankan ulang skrip ini setiap kali notebook dijalankan ulang. Server Express hanya
membaca JSON hasilnya (tidak menjalankan Python), jadi tidak ada dependensi baru saat deploy.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

DAILY_MODELS = ["XGBoost", "SARIMA", "Random Forest", "MLP"]
BASELINE = "Seasonal Naive"
SLOT_MODELS = ["XGBoost", "SARIMA", BASELINE]


def metrics(actual, pred):
    err = pred - actual
    return {
        "mae": round(float(err.abs().mean()), 4),
        "rmse": round(float(np.sqrt((err ** 2).mean())), 4),
        "n": int(len(actual)),
    }


def num(v, digits=2):
    return None if pd.isna(v) else round(float(v), digits)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src", type=Path)
    ap.add_argument("--out", type=Path, default=Path(__file__).resolve().parents[1] / "src/model-data/xgboost_h2.json")
    args = ap.parse_args()
    src = args.src

    daily = pd.read_csv(src / "backtest_demand_per_sku.csv", parse_dates=["order_date"])
    slot = pd.read_csv(src / "backtest_slot_pengiriman_simulasi.csv", parse_dates=["delivery_date"])
    forecast = json.loads((src / "forecast_h2.json").read_text(encoding="utf-8"))
    slot_demo = json.loads((src / "forecast_slot_demo.json").read_text(encoding="utf-8"))

    # --- Perbandingan model, harian per SKU (sama dengan evaluasi di notebook) ---
    has_actual = daily.dropna(subset=["quantity_clean"])
    daily_cmp = {m: metrics(has_actual["quantity_clean"], has_actual[m]) for m in DAILY_MODELS}
    base = daily.dropna(subset=["quantity_clean", BASELINE])
    daily_cmp[BASELINE] = metrics(base["quantity_clean"], base[BASELINE])

    # --- Perbandingan model, slot pengiriman (hanya pasangan slot-SKU yang lengkap) ---
    slot_complete = slot.dropna(subset=["actual_units_simulated"] + SLOT_MODELS)
    slot_cmp = {m: metrics(slot_complete["actual_units_simulated"], slot_complete[m]) for m in SLOT_MODELS}

    # --- MAE XGBoost per SKU ---
    names = {r["sku_id"]: r for r in forecast["demand_by_sku"]}
    per_sku = []
    for sku, g in has_actual.groupby("sku_id"):
        m = metrics(g["quantity_clean"], g["XGBoost"])
        per_sku.append({
            "sku_id": sku,
            "product_name": names[sku]["product_name"],
            "variant": names[sku]["variant"],
            "mae": m["mae"],
            "n": m["n"],
            "avg_actual": round(float(g["quantity_clean"].mean()), 2),
        })

    # --- Deret waktu untuk grafik: aktual vs XGBoost vs SARIMA per SKU ---
    series = {}
    for sku, g in daily.sort_values("order_date").groupby("sku_id"):
        series[sku] = [
            [d.strftime("%Y-%m-%d"), num(a, 1), num(x), num(s)]
            for d, a, x, s in zip(g["order_date"], g["quantity_clean"], g["XGBoost"], g["SARIMA"])
        ]

    # --- Total per slot (hanya slot yang seluruh SKU-nya lengkap) ---
    by_slot = slot.groupby("delivery_date")
    slot_series = []
    for d, g in by_slot:
        # Seasonal Naive sengaja tidak disyaratkan: TW002 memang tidak punya nilai baseline.
        if len(g.dropna(subset=["actual_units_simulated", "XGBoost", "SARIMA"])) != g["sku_id"].nunique():
            continue
        slot_series.append({
            "delivery_date": d.strftime("%Y-%m-%d"),
            "actual": round(float(g["actual_units_simulated"].sum()), 1),
            "XGBoost": round(float(g["XGBoost"].sum()), 1),
            "SARIMA": round(float(g["SARIMA"].sum()), 1),
        })

    artifact = {
        "schema_version": 1,
        "model": "XGBoost",
        "model_version": slot_demo.get("model_version"),
        "is_simulation": True,
        "data_note": "Data pesanan sintetis. Angka akurasi belum mewakili penjualan sungguhan.",
        "horizon_days": forecast["horizon_days"],
        "backtest": {
            "daily_from": daily["order_date"].min().strftime("%Y-%m-%d"),
            "daily_to": daily["order_date"].max().strftime("%Y-%m-%d"),
            "slot_from": slot["delivery_date"].min().strftime("%Y-%m-%d"),
            "slot_to": slot["delivery_date"].max().strftime("%Y-%m-%d"),
            "daily": daily_cmp,
            "slot": slot_cmp,
            "xgboost_per_sku": per_sku,
            "daily_series": series,
            "slot_series": slot_series,
        },
        "forecast_h2": forecast,
        "forecast_slot": slot_demo,
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(artifact, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")
    print(f"Ditulis: {args.out} ({args.out.stat().st_size / 1024:.1f} KB)")
    print("Harian :", {k: (v['mae'], v['n']) for k, v in daily_cmp.items()})
    print("Slot   :", {k: (v['mae'], v['n']) for k, v in slot_cmp.items()})


if __name__ == "__main__":
    main()
