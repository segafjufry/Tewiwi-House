import { Router } from 'express';
import { adminOnly } from '../middleware/adminAuth.js';
import { evaluate, predict } from '../services/predictionService.js';
import { loadH2Forecast } from '../services/mlService.js';

// Inference API untuk model prediksi demand (khusus admin).
// adminOnly dipasang per route, bukan r.use(), supaya URL /api/... yang tidak ada tetap 404.
export default function modelRouter(db) {
  const r = Router();
  r.post('/predict', adminOnly, async (req, res) => res.json({ data: await predict(db, req.body?.delivery_date) }));
  r.get('/model/evaluation', adminOnly, async (req, res) => res.json({ data: await evaluate(db) }));
  // Forecast XGBoost H-2 per SKU + backtest, untuk tab Statistik di dashboard admin.
  r.get('/model/h2-forecast', adminOnly, (req, res) => res.json({ data: loadH2Forecast() }));
  return r;
}
