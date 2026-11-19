import { readFileSync } from 'node:fs';
import { AppError } from '../utils/errors.js';
import { weekdayOf } from '../utils/dates.js';
import { reqDate } from '../utils/validate.js';

// Artefak dibuat oleh `python model/build_artifact.py <folder ekspor notebook>`.
// Isinya hasil backtest dan forecast XGBoost H-2 dari notebook. Node tidak menjalankan
// Python/joblib; server hanya membaca JSON ini, sehingga tidak ada dependensi baru.
const ARTIFACT_URL = new URL('../model-data/xgboost_h2.json', import.meta.url);

let cache = null;

export function loadModelArtifact(url = ARTIFACT_URL) {
  if (url === ARTIFACT_URL && cache) return cache;
  let data;
  try {
    data = JSON.parse(readFileSync(url, 'utf8'));
  } catch {
    throw new AppError(503, 'MODEL_ARTIFACT_MISSING', 'Artefak model belum tersedia. Jalankan model/build_artifact.py terlebih dahulu.');
  }
  if (data?.schema_version !== 1 || !data.forecast_h2 || !data.backtest) {
    throw new AppError(503, 'MODEL_ARTIFACT_INVALID', 'Artefak model tidak sesuai skema versi 1.');
  }
  if (url === ARTIFACT_URL) cache = data;
  return data;
}

// Ringkasan untuk tab Statistik. `series` dikirim penuh karena kecil (~30 KB) dan dipakai grafik.
export function xgboostStatistics(url) {
  const a = loadModelArtifact(url);
  const { forecast_h2: f, forecast_slot: slot, backtest: b } = a;
  const demand = f.demand_by_sku.map((r) => ({
    sku_id: r.sku_id,
    product_name: r.product_name,
    variant: r.variant,
    stock_product_id: r.stock_product_id,
    forecast_units: r.forecast_units,
  }));
  const slotBySku = new Map((slot?.demand_by_sku ?? []).map((r) => [r.sku_id, r.forecast_units]));
  const sum = (xs) => xs.reduce((x, y) => x + y, 0);

  return {
    model: a.model,
    model_version: a.model_version,
    is_simulation: a.is_simulation,
    data_note: a.data_note,
    horizon_days: a.horizon_days,
    forecast: {
      forecast_origin: f.forecast_origin,
      target_date: f.target_date,
      total_units: +sum(demand.map((d) => d.forecast_units)).toFixed(2),
      per_sku: demand.map((d) => ({ ...d, slot_units: slotBySku.get(d.sku_id) ?? null })),
      stock_by_product: f.stock_by_product,
    },
    slot_forecast: slot
      ? {
          delivery_date: slot.delivery_date,
          slot_forecast_origin: slot.slot_forecast_origin,
          order_window_start: slot.order_window_start,
          order_window_end: slot.order_window_end,
          order_cutoff_days: slot.order_cutoff_days,
          total_units: +sum(slot.demand_by_sku.map((d) => d.forecast_units)).toFixed(2),
        }
      : null,
    backtest: b,
  };
}

/**
 * Forecast XGBoost H-2 untuk satu tanggal pengiriman lewat layanan FastAPI (POST /api/v1/forecasts).
 * Model dijalankan di Python; Express hanya meneruskan permintaan dan memetakan galatnya.
 */
export async function liveForecast(baseUrl, date, { timeoutMs = 15_000 } = {}) {
  reqDate(date, 'date');
  const wd = weekdayOf(date);
  if (wd !== 2 && wd !== 5) throw new AppError(400, 'VALIDATION_ERROR', 'Pilih tanggal pengiriman pada Selasa atau Jumat');
  if (!baseUrl) throw new AppError(503, 'MODEL_SERVICE_NOT_CONFIGURED', 'FORECAST_API_URL belum diisi');
  let res;
  try {
    res = await fetch(`${baseUrl}/api/v1/forecasts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ target_date: date }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new AppError(502, 'MODEL_SERVICE_UNREACHABLE', 'Layanan forecast tidak dapat dihubungi');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = typeof body?.detail === 'string' ? body.detail : 'Layanan forecast menolak permintaan';
    throw new AppError(res.status === 422 ? 422 : 502, res.status === 422 ? 'FORECAST_REJECTED' : 'MODEL_SERVICE_ERROR', detail);
  }
  if (body?.schema_version !== 1 || !Array.isArray(body.demand_by_sku)) {
    throw new AppError(502, 'MODEL_SERVICE_ERROR', 'Respons layanan forecast tidak sesuai skema versi 1');
  }
  return body;
}
