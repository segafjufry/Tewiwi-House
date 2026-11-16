import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { AppError } from '../utils/errors.js';
import { todayISO } from '../utils/dates.js';

// Artefak model XGBoost H-2 hasil notebook (CapstoneProjectMVP_Tewiwi.ipynb).
// Backend Node tidak menjalankan file .joblib; yang dipakai adalah ekspor untuk website:
//   forecast_h2.json, backtest_demand_per_sku.csv, backtest_stok_per_produk.csv
const DIR = process.env.ML_ARTIFACT_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '../../data/ml');
const SELECTED_MODEL = 'XGBoost';
const ID_COLUMNS = new Set(['order_date', 'forecast_origin', 'sku_id', 'stock_product_id', 'quantity_clean']);

const DAY_MS = 86_400_000;
const round = (n, d = 2) => +Number(n).toFixed(d);

function readText(name) {
  try {
    return readFileSync(path.join(DIR, name), 'utf8');
  } catch {
    throw new AppError(503, 'MODEL_ARTIFACT_MISSING', `Berkas model ${name} tidak ditemukan di server`);
  }
}

// CSV sederhana (tanpa tanda kutip). Sel kosong => null.
export function parseCsv(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
  const header = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    header.forEach((h, i) => {
      const v = (cells[i] ?? '').trim();
      row[h] = v === '' ? null : ID_COLUMNS.has(h) && h !== 'quantity_clean' ? v : Number(v);
    });
    return row;
  });
}

/** MAE per model. Baris tanpa nilai aktual dilewati. */
export function maeByModel(rows, models) {
  const out = {};
  for (const m of models) {
    let sum = 0, n = 0;
    for (const r of rows) {
      if (r.quantity_clean == null || r[m] == null) continue;
      sum += Math.abs(r[m] - r.quantity_clean);
      n++;
    }
    out[m] = { mae: n ? round(sum / n, 4) : null, n };
  }
  return out;
}

function summarize(rows) {
  const models = Object.keys(rows[0] ?? {}).filter((k) => !ID_COLUMNS.has(k));
  const mae = maeByModel(rows, models);
  const ranking = models
    .filter((m) => mae[m].mae != null)
    .map((m) => ({ model: m, mae: mae[m].mae, n_observations: mae[m].n }))
    .sort((a, b) => a.mae - b.mae);
  return { models, ranking };
}

// Total harian aktual vs prediksi model terpilih, hanya baris yang punya aktual agar sebanding.
function dailySeries(rows, model) {
  const byDate = new Map();
  for (const r of rows) {
    if (r.quantity_clean == null || r[model] == null) continue;
    const d = byDate.get(r.order_date) ?? { date: r.order_date, actual: 0, predicted: 0 };
    d.actual += r.quantity_clean;
    d.predicted += r[model];
    byDate.set(r.order_date, d);
  }
  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ date: d.date, actual: round(d.actual, 1), predicted: round(d.predicted, 1) }));
}

let cache = null;

export function loadH2Forecast() {
  if (cache) return cache;
  const forecast = JSON.parse(readText('forecast_h2.json'));
  const skuRows = parseCsv(readText('backtest_demand_per_sku.csv'));
  const stockRows = parseCsv(readText('backtest_stok_per_produk.csv'));
  const sku = summarize(skuRows);
  const stock = summarize(stockRows);

  // Tanggal target forecast disematkan ke tiap baris supaya hasil forecast
  // membawa tanggalnya — penjual tahu ini prediksi untuk tanggal mana.
  const targetDate = forecast.target_date;
  const demand = forecast.demand_by_sku.map((d) => ({ ...d, forecast_units: round(d.forecast_units), target_date: targetDate }));
  const stockDemand = forecast.stock_by_product.map((s) => ({ ...s, gross_demand_units: round(s.gross_demand_units), target_date: targetDate }));
  const ageDays = Math.round((Date.parse(`${todayISO()}T00:00:00Z`) - Date.parse(`${forecast.target_date}T00:00:00Z`)) / DAY_MS);

  cache = {
    model: forecast.model || SELECTED_MODEL,
    horizon_days: forecast.horizon_days,
    forecast_origin: forecast.forecast_origin,
    target_date: forecast.target_date,
    // > 0 artinya tanggal target sudah lewat: forecast ini snapshot, bukan prediksi terbaru.
    age_days: ageDays,
    total_forecast_units: round(demand.reduce((a, b) => a + b.forecast_units, 0)),
    demand_by_sku: demand,
    stock_by_product: stockDemand,
    backtest: {
      period: {
        from: skuRows.map((r) => r.order_date).sort()[0],
        to: skuRows.map((r) => r.order_date).sort().at(-1),
      },
      selected_model: forecast.model || SELECTED_MODEL,
      sku: { ranking: sku.ranking },
      stock: { ranking: stock.ranking },
      daily_total: dailySeries(skuRows, forecast.model || SELECTED_MODEL),
    },
  };
  return cache;
}

// Hanya untuk tes.
export function _resetCache() { cache = null; }
