import test from 'node:test';
import assert from 'node:assert/strict';
import { xgboostStatistics, loadModelArtifact } from '../src/services/modelArtifactService.js';

test('artefak XGBoost terbaca dan metrik sesuai notebook', () => {
  const s = xgboostStatistics();
  assert.equal(s.model, 'XGBoost');
  assert.equal(s.is_simulation, true);
  assert.equal(s.backtest.daily.XGBoost.mae, 3.2098);
  assert.equal(s.backtest.daily.XGBoost.n, 773);
  assert.equal(s.backtest.slot.XGBoost.mae, 7.02);
  assert.equal(s.backtest.slot.XGBoost.n, 166);
});

test('forecast H-2 memuat 11 SKU dan totalnya konsisten', () => {
  const { forecast } = xgboostStatistics();
  assert.equal(forecast.per_sku.length, 11);
  assert.equal(forecast.target_date, '2026-01-02');
  const total = forecast.per_sku.reduce((a, r) => a + r.forecast_units, 0);
  assert.ok(Math.abs(total - forecast.total_units) < 0.05);
  assert.ok(forecast.per_sku.every((r) => r.forecast_units >= 0 && r.slot_units > 0));
  // Dua ukuran brownies digabung menjadi satu produk stok.
  const brownies = forecast.stock_by_product.find((p) => p.stock_product_id === 'TW001');
  assert.deepEqual(brownies.sku_ids, ['TW001', 'TW002']);
});

test('deret grafik tersedia untuk setiap SKU', () => {
  const { backtest } = xgboostStatistics();
  assert.equal(Object.keys(backtest.daily_series).length, 11);
  assert.ok(backtest.slot_series.length > 0);
});

test('berkas artefak hilang -> 503 dengan kode yang jelas', () => {
  assert.throws(
    () => loadModelArtifact(new URL('file:///tidak/ada.json')),
    (e) => e.status === 503 && e.code === 'MODEL_ARTIFACT_MISSING'
  );
});

// ── liveForecast: layanan FastAPI palsu ──
import http from 'node:http';
import { once } from 'node:events';
import { liveForecast } from '../src/services/modelArtifactService.js';

async function fakeService(handler) {
  const srv = http.createServer(handler).listen(0, '127.0.0.1');
  await once(srv, 'listening');
  return { url: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close() };
}

test('liveForecast meneruskan tanggal dan mengembalikan payload', async () => {
  let got;
  const s = await fakeService((req, res) => {
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
      got = JSON.parse(b);
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ schema_version: 1, demand_by_sku: [], stock_by_product: [] }));
    });
  });
  try {
    const out = await liveForecast(s.url, '2026-11-20'); // Jumat
    assert.deepEqual(got, { target_date: '2026-11-20' });
    assert.equal(out.schema_version, 1);
  } finally { s.close(); }
});

test('liveForecast: hari bukan Selasa/Jumat ditolak, URL kosong = 503', async () => {
  await assert.rejects(liveForecast('http://x', '2026-11-18'), (e) => e.status === 400); // Rabu
  await assert.rejects(liveForecast('', '2026-11-20'), (e) => e.status === 503 && e.code === 'MODEL_SERVICE_NOT_CONFIGURED');
});

test('liveForecast: 422 dari layanan diteruskan, layanan mati = 502', async () => {
  const s = await fakeService((req, res) => { res.statusCode = 422; res.end(JSON.stringify({ detail: 'Data aktual belum lengkap' })); });
  try {
    await assert.rejects(liveForecast(s.url, '2026-11-20'), (e) => e.status === 422 && /aktual/.test(e.message));
  } finally { s.close(); }
  await assert.rejects(liveForecast('http://127.0.0.1:1', '2026-11-20'), (e) => e.status === 502 && e.code === 'MODEL_SERVICE_UNREACHABLE');
});
