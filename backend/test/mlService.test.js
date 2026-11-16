// Tes tanpa database: memeriksa pembacaan artefak model XGBoost H-2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadH2Forecast, maeByModel, parseCsv } from '../src/services/mlService.js';

test('parseCsv: sel kosong jadi null, angka jadi number', () => {
  const rows = parseCsv('order_date,sku_id,quantity_clean,XGBoost\n2025-10-30,TW001,,13.5\n2025-10-31,TW001,10,16\n');
  assert.deepEqual(rows[0], { order_date: '2025-10-30', sku_id: 'TW001', quantity_clean: null, XGBoost: 13.5 });
  assert.equal(rows[1].quantity_clean, 10);
});

test('maeByModel melewati baris tanpa nilai aktual', () => {
  const rows = [
    { quantity_clean: 10, A: 12 },
    { quantity_clean: null, A: 999 },
    { quantity_clean: 4, A: 3 },
  ];
  assert.deepEqual(maeByModel(rows, ["A"]).A, { mae: 1.5, n: 2 });
});

test('loadH2Forecast: bentuk data dan konsistensi stok vs SKU', () => {
  const d = loadH2Forecast();
  assert.equal(d.model, 'XGBoost');
  assert.equal(d.horizon_days, 2);
  assert.equal(d.demand_by_sku.length, 11);
  assert.equal(d.stock_by_product.length, 10);
  // Total per SKU harus sama dengan total per produk stok.
  const bySku = d.demand_by_sku.reduce((a, b) => a + b.forecast_units, 0);
  const byStock = d.stock_by_product.reduce((a, b) => a + b.gross_demand_units, 0);
  assert.ok(Math.abs(bySku - byStock) < 0.05);
  assert.ok(d.backtest.sku.ranking.length >= 4);
  assert.ok(d.backtest.daily_total.length > 30);
  for (const r of d.backtest.sku.ranking) assert.ok(r.mae > 0 && r.n_observations > 100);
  // Tiap baris hasil forecast membawa tanggal targetnya.
  for (const s of d.demand_by_sku) assert.equal(s.target_date, d.target_date);
  for (const s of d.stock_by_product) assert.equal(s.target_date, d.target_date);
});
