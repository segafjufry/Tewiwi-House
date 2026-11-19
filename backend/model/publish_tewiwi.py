"""Publish the next XGBoost H-2 forecast from a trusted Tewiwi model bundle."""

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd


def make_payload(sku_forecast, catalog, model_name):
    """Build both website views from one date and the same set of SKU predictions."""
    demand = sku_forecast[
        ["order_date", "forecast_origin", "sku_id", model_name]
    ].rename(columns={model_name: "forecast_units"}).merge(
        catalog, on="sku_id", how="left", validate="one_to_one"
    )
    if set(demand["sku_id"]) != set(catalog["sku_id"]):
        raise ValueError("Forecast harus memuat semua SKU dalam katalog.")
    if demand[["order_date", "forecast_origin"]].drop_duplicates().shape[0] != 1:
        raise ValueError("Publikasikan satu tanggal target dan satu origin per berkas.")
    if not np.isfinite(demand["forecast_units"]).all() or demand["forecast_units"].lt(0).any():
        raise ValueError("Forecast harus berisi angka nonnegatif yang valid.")

    demand = demand.sort_values("sku_id")
    demand_rows = [
        {
            "sku_id": row.sku_id,
            "product_name": row.product_name,
            "variant": None if pd.isna(row.variant) else row.variant,
            "stock_product_id": row.stock_product_id,
            "forecast_units": float(row.forecast_units),
        }
        for row in demand.itertuples(index=False)
    ]
    stock_rows = [
        {
            "stock_product_id": stock_id,
            "product_name": group["product_name"].iloc[0],
            "sku_ids": group["sku_id"].tolist(),
            "gross_demand_units": float(group["forecast_units"].sum()),
        }
        for stock_id, group in demand.groupby("stock_product_id", sort=True)
    ]
    origin = demand["forecast_origin"].iloc[0]
    target_date = demand["order_date"].iloc[0]
    return {
        "schema_version": 1,
        "model": model_name,
        "forecast_origin": origin.strftime("%Y-%m-%d"),
        "target_date": target_date.strftime("%Y-%m-%d"),
        "horizon_days": (target_date - origin).days,
        "demand_by_sku": demand_rows,
        "stock_by_product": stock_rows,
    }

def build_h2_features(daily_panel, horizon, target):
    data = daily_panel.sort_values(["sku_id", "order_date"]).copy()
    dates = data["order_date"].dt
    data["forecast_origin"] = data["order_date"] - pd.Timedelta(days=horizon)

    data["day_of_week"] = dates.dayofweek
    data["day_of_month"] = dates.day
    data["month"] = dates.month
    data["week_of_year"] = dates.isocalendar().week.astype(int)
    data["is_weekend"] = (dates.dayofweek >= 5).astype(int)
    data["is_month_start"] = dates.is_month_start.astype(int)
    data["is_month_end"] = dates.is_month_end.astype(int)

    sales = data.groupby("sku_id")[target]
    for lag in (horizon, 3, 7, 14):
        data[f"lag_{lag}"] = sales.shift(lag)

    for window in (7, 14):
        data[f"rolling_mean_{window}"] = sales.transform(
            lambda s: s.shift(horizon).rolling(window, min_periods=3).mean()
        )
        data[f"history_count_{window}"] = sales.transform(
            lambda s: s.shift(horizon).rolling(window, min_periods=1).count()
        )

    data["rolling_std_7"] = sales.transform(
        lambda s: s.shift(horizon).rolling(7, min_periods=3).std()
    )
    return data

def publish(model_path, origin, sales_path):
    # Only load model bundles generated and controlled by this project.
    bundle = joblib.load(model_path)
    if bundle["format_version"] != 2:
        raise ValueError("Gunakan berkas model versi per SKU dari notebook revisi.")

    trained_through = bundle["trained_through"]
    if origin < trained_through:
        raise ValueError("Origin lebih awal dari data yang dipakai model. Gunakan hasil backtest.")
    if origin > trained_through:
        if sales_path is None:
            raise ValueError("Tambahkan CSV aktual sampai tanggal origin.")
        sales = pd.read_csv(sales_path, dtype={"sku_id": "string"})
        sales["order_date"] = pd.to_datetime(
            sales["order_date"], format="%Y-%m-%d", errors="raise"
        )
        sales = sales.loc[sales["order_date"].between(
            trained_through + pd.Timedelta(days=1), origin
        )].copy()
        catalog_ids = set(bundle["catalog"]["sku_id"])
        if sales.empty or sales["order_date"].max() != origin:
            raise ValueError("CSV belum memuat aktual pada tanggal origin.")
        if sales["sku_id"].isna().any() or not set(sales["sku_id"]) <= catalog_ids:
            raise ValueError("Ada SKU kosong atau belum terdaftar.")
        if sales.duplicated(["order_date", "sku_id"]).any():
            raise ValueError("Jumlahkan transaksi menjadi satu baris per tanggal dan SKU.")
        qty = pd.to_numeric(sales["quantity"], errors="raise")
        sales["quantity"] = qty.where(np.isfinite(qty) & qty.ge(0))
        dates = pd.date_range(trained_through + pd.Timedelta(days=1), origin, freq="D")
        updates = sales.pivot(index="order_date", columns="sku_id", values="quantity").reindex(
            index=dates, columns=bundle["catalog"]["sku_id"]
        ).astype(float)
    else:
        updates = None

    horizon = bundle["horizon_days"]
    target_date = origin + pd.Timedelta(days=horizon)
    target = bundle["target"]
    catalog = bundle["catalog"]
    keys = ["order_date", "sku_id"]

    history = bundle["recent_history"][keys + [target]].copy()

    if updates is not None:
        new_history = (
            updates.rename_axis(index="order_date", columns="sku_id")
            .reset_index()
            .melt(id_vars="order_date", var_name="sku_id", value_name=target)
        )
        history = pd.concat([history, new_history], ignore_index=True)

    # Lengkapi kalender hingga tanggal target. Hari yang belum punya aktual
    # tetap kosong, termasuk H−1 dan H.
    calendar = pd.date_range(
        start=origin - pd.Timedelta(days=13),
        end=target_date,
        freq="D",
    )
    full_index = pd.MultiIndex.from_product(
        [calendar, catalog["sku_id"]], names=keys
    )
    daily_panel = history.set_index(keys).reindex(full_index).reset_index()

    feature_panel = build_h2_features(daily_panel, horizon, target)
    target_rows = feature_panel.loc[
        feature_panel["order_date"].eq(target_date)
    ].copy()

    pipeline = bundle["ml_models"]["XGBoost"]
    forecast = target_rows[keys + ["forecast_origin"]].copy()
    forecast["XGBoost"] = np.maximum(
        0, pipeline.predict(target_rows[bundle["features"]])
    )

    return make_payload(forecast, catalog, "XGBoost")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--origin", required=True, help="Tanggal aktual terakhir, YYYY-MM-DD")
    parser.add_argument("--sales", type=Path, help="CSV aktual baru dengan order_date,sku_id,quantity")
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    origin = pd.to_datetime(args.origin, format="%Y-%m-%d", errors="raise")
    payload = publish(args.model, origin, args.sales)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = args.output.with_suffix(args.output.suffix + ".tmp")
    temporary_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    temporary_path.replace(args.output)


if __name__ == "__main__":
    main()
