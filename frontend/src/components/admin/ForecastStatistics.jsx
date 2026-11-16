import { useEffect, useState } from 'react'
import { Alert, Paper } from '@mui/material'
import { getH2Forecast } from '../../services/api'

const fmtDate = (iso) =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${iso}T00:00:00`))
const fmtShort = (iso) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(`${iso}T00:00:00`))
const num = (n, d = 1) => Number(n).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
const skuLabel = (d) => (d.variant && d.variant !== 'Standard' ? `${d.product_name} (${d.variant})` : d.product_name)

// Grafik batang horizontal: forecast permintaan per SKU.
function ForecastBars({ items }) {
  const rows = [...items].sort((a, b) => b.forecast_units - a.forecast_units)
  const max = Math.max(...rows.map((r) => r.forecast_units), 1)
  return (
    <div className="forecast-bars" role="img" aria-label="Forecast permintaan per SKU">
      {rows.map((r) => (
        <div className="forecast-bar-row" key={r.sku_id}>
          <span className="forecast-bar-label">{skuLabel(r)}</span>
          <div className="forecast-bar-track">
            <div className="forecast-bar-fill" style={{ width: `${(r.forecast_units / max) * 100}%` }} />
          </div>
          <strong className="forecast-bar-value">{num(r.forecast_units)}</strong>
        </div>
      ))}
    </div>
  )
}

// Grafik garis SVG: total aktual vs prediksi XGBoost per hari pada periode backtest.
function BacktestLine({ series }) {
  const W = 640, H = 240, L = 40, R = 12, T = 12, B = 28
  const maxY = Math.max(...series.flatMap((d) => [d.actual, d.predicted]), 1)
  const top = Math.ceil(maxY / 20) * 20
  const x = (i) => L + (i / Math.max(series.length - 1, 1)) * (W - L - R)
  const y = (v) => T + (1 - v / top) * (H - T - B)
  const path = (key) => series.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ')
  const ticks = [0, top / 2, top]
  const labelIdx = [0, Math.floor(series.length / 3), Math.floor((2 * series.length) / 3), series.length - 1]
  return (
    <svg className="forecast-line" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Aktual versus prediksi XGBoost per hari">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e3e9f7" />
          <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#536995">{t}</text>
        </g>
      ))}
      {labelIdx.map((i) => (
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#536995">{fmtShort(series[i].date)}</text>
      ))}
      <path d={path('actual')} fill="none" stroke="#092f9e" strokeWidth="2" />
      <path d={path('predicted')} fill="none" stroke="#e08a1e" strokeWidth="2" strokeDasharray="5 3" />
    </svg>
  )
}

export default function ForecastStatistics() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getH2Forecast()
      .then((d) => { if (active) setData(d) })
      .catch((err) => { if (active) setError(err.code === 'NETWORK_ERROR' ? 'Tidak dapat terhubung ke server.' : err.message ?? 'Gagal memuat forecast') })
    return () => { active = false }
  }, [])

  if (error) return <Alert severity="error">{error}</Alert>
  if (!data) return <p className="muted">Memuat forecast…</p>

  const xgb = data.backtest.sku.ranking.find((r) => r.model === data.backtest.selected_model)
  const best = data.backtest.sku.ranking[0]
  const stale = data.age_days > 0

  return (
    <div className="forecast-stats">
      {stale && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Ini snapshot model: forecast dibuat dari data sampai {fmtDate(data.forecast_origin)} untuk tanggal {fmtDate(data.target_date)}.
          Angka belum diperbarui dengan penjualan terbaru.
        </Alert>
      )}

      <div className="forecast-kpis">
        <Paper className="stat-card" elevation={0}>
          <span>Forecast {fmtShort(data.target_date)} (H-{data.horizon_days})</span>
          <strong>{num(data.total_forecast_units, 0)} pcs</strong>
        </Paper>
        <Paper className="stat-card" elevation={0}>
          <span>MAE {data.model} (backtest)</span>
          <strong>{num(xgb.mae, 2)} pcs</strong>
        </Paper>
        <Paper className="stat-card" elevation={0}>
          <span>Model {best.model === data.model ? 'terbaik' : 'terbaik lain'}</span>
          <strong>{best.model}</strong>
        </Paper>
      </div>

      <section className="forecast-section">
        <h2 className="forecast-heading">Forecast permintaan per SKU</h2>
        <p className="muted forecast-note">Prediksi untuk pengiriman {fmtDate(data.target_date)}</p>
        <ForecastBars items={data.demand_by_sku} />
      </section>

      <section className="forecast-section">
        <h2 className="forecast-heading">Aktual vs prediksi {data.model} (total harian)</h2>
        <p className="muted forecast-note">Periode uji {fmtDate(data.backtest.period.from)} – {fmtDate(data.backtest.period.to)}</p>
        <BacktestLine series={data.backtest.daily_total} />
        <div className="forecast-legend">
          <span><i className="legend-actual" /> Aktual</span>
          <span><i className="legend-pred" /> Prediksi {data.model}</span>
        </div>
      </section>

      <section className="forecast-section">
        <h2 className="forecast-heading">Kebutuhan stok per produk</h2>
        <p className="muted forecast-note">Prediksi untuk pengiriman {fmtDate(data.target_date)}</p>
        <div className="forecast-table-wrap">
          <table className="forecast-table">
            <thead><tr><th>Produk</th><th>SKU</th><th>Kebutuhan (pcs)</th></tr></thead>
            <tbody>
              {data.stock_by_product.map((s) => (
                <tr key={s.stock_product_id}>
                  <td>{s.product_name}</td>
                  <td>{s.sku_ids.join(', ')}</td>
                  <td>{num(s.gross_demand_units)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="forecast-section">
        <h2 className="forecast-heading">Perbandingan model (MAE, makin kecil makin baik)</h2>
        <div className="forecast-table-wrap">
          <table className="forecast-table">
            <thead><tr><th>Model</th><th>MAE per SKU-hari</th><th>Observasi</th></tr></thead>
            <tbody>
              {data.backtest.sku.ranking.map((r) => (
                <tr key={r.model} className={r.model === data.model ? 'is-selected' : ''}>
                  <td>{r.model}</td>
                  <td>{num(r.mae, 3)}</td>
                  <td>{r.n_observations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted forecast-note">
          Dilatih pada data sintetis. XGBoost dan SARIMA nyaris seri; XGBoost dipilih untuk demo. Bandingkan ulang saat data penjualan asli tersedia.
        </p>
      </section>
    </div>
  )
}
