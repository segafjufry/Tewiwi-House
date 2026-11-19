"""Layanan FastAPI forecast Tewiwi (dipanggil oleh backend Express lewat FORECAST_API_URL).

Jalankan dari folder model/:
    uvicorn forecast_api:app --host 127.0.0.1 --port 8000
Butuh: Tewiwi_H-2_Per_SKU.joblib di folder ini dan, untuk tanggal
setelah akhir data latih, aktual_baru.csv dengan kolom order_date,sku_id,quantity.
"""
import logging
from datetime import date
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from publish_tewiwi import publish

# from rag_service import router as rag_router  # aktifkan jika rag_service.py ada di folder ini

app = FastAPI(title="Tewiwi Forecast API", version="1.0.0")
# app.include_router(rag_router)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "Tewiwi_H-2_Per_SKU.joblib"
SALES_PATH = BASE_DIR / "aktual_baru.csv"


class ForecastRequest(BaseModel):
    target_date: date


@app.post("/api/v1/forecasts")
def create_forecast(request: ForecastRequest):
    if request.target_date.weekday() not in (1, 4):
        raise HTTPException(status_code=422, detail="Pilih tanggal pengiriman pada Selasa atau Jumat.")
    if not MODEL_PATH.is_file():
        raise HTTPException(status_code=503, detail="File model forecast belum tersedia.")
    try:
        origin = pd.Timestamp(request.target_date) - pd.Timedelta(days=2)
        return publish(
            model_path=MODEL_PATH,
            origin=origin,
            sales_path=SALES_PATH if SALES_PATH.is_file() else None,
        )
    except (ValueError, OverflowError) as exc:
        logger.warning("Forecast tidak dapat diproses: %s", exc)
        raise HTTPException(status_code=422, detail="Tanggal atau data aktual tidak memenuhi syarat forecast.") from exc
    except Exception as exc:
        logger.exception("Inferensi XGBoost gagal.")
        raise HTTPException(status_code=500, detail="Prediksi gagal diproses.") from exc
