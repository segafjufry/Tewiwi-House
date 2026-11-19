import { Router } from 'express';
import { adminOnly } from '../middleware/adminAuth.js';
import { evaluate, predict } from '../services/predictionService.js';
import { liveForecast, xgboostStatistics } from '../services/modelArtifactService.js';

// Inference API untuk model prediksi demand (khusus admin).
// adminOnly dipasang per route, bukan r.use(), supaya URL /api/... yang tidak ada tetap 404.
export default function modelRouter(db, cfg = {}) {
  const r = Router();
  r.post('/predict', adminOnly, async (req, res) => res.json({ data: await predict(db, req.body?.delivery_date) }));
  r.get('/model/evaluation', adminOnly, async (req, res) => res.json({ data: await evaluate(db) }));
  // Statistik model XGBoost H-2 (hasil notebook): forecast terbaru + backtest. Dibaca dari artefak JSON, tanpa database.
  r.get('/model/xgboost', adminOnly, (req, res) => res.json({ data: xgboostStatistics() }));
  // Forecast per tanggal dari layanan Python (opsional, perlu FORECAST_API_URL).
  r.get('/model/forecast', adminOnly, async (req, res) =>
    res.json({ data: await liveForecast(cfg.forecastApiUrl, req.query.date) }));
  return r;
}
