import { useEffect, useState } from 'react'
import { Alert } from '@mui/material'
import { getLiveForecast, getSlots, getXgboostStatistics } from '../../services/api'

const nf1 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const nf2 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function fmtDate(iso, withWeekday = false) {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  return new Intl.DateTimeFormat('id-ID', {
    ...(withWeekday ? { weekday: 'long' } : {}),
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

function shortDate(iso) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(`${iso}T00:00:00`))
}

function skuLabel(row) {
  const variant = row.variant && !['Standard', 'Package'].includes(row.variant) ? ` (${row.variant})` : ''
  return `${row.product_name}${variant}`
}

// ─── Grafik SVG sederhana (tanpa library tambahan) ───────────────────────────

const COLORS = { actual: '#6b7a99', xgb: '#092f9e', sarima: '#c77d1a' }

function niceMax(v) {
  if (v <= 0) return 1
  const step = 10 ** Math.floor(Math.log10(v))
  return Math.ceil(v / step) * step
}

function BarChart({ rows, label }) {
  const W = 480
  const rowH = 28
  const left = 160
  const right = 56
  const H = rows.length * rowH + 12
  const max = niceMax(Math.max(...rows.map((r) => r.value)))
  const scale = (v) => ((W - left - right) * v) / max
  function truncate(text, maxLen = 22) {
    return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stat-svg" role="img" aria-label={label}>
      {rows.map((r, i) => {
        const y = 6 + i * rowH
        return (
          <g key={r.key}>
            <text x={left - 8} y={y + 14} textAnchor="end" className="stat-svg-label">{truncate(r.label)}</text>
            <rect x={left} y={y} width={Math.max(scale(r.value), 1)} height={rowH - 8} rx="4" fill={COLORS.xgb} />
            <text x={left + scale(r.value) + 6} y={y + 14} className="stat-svg-value">{nf1.format(r.value)}</text>
          </g>
        )
      })}
    </svg>
  )
}

function LineChart({ points, label }) {
  const W = 640
  const H = 260
  const pad = { l: 36, r: 12, t: 12, b: 28 }
  const values = points.flatMap((p) => [p.xgb, p.sarima]).filter((v) => v != null)
  const max = niceMax(Math.max(...values, 1))
  const n = points.length
  const x = (i) => pad.l + ((W - pad.l - pad.r) * i) / Math.max(n - 1, 1)
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max)

  // Putus garis di tanggal tanpa data aktual (tidak diinterpolasi).
  function path(key) {
    let d = ''
    let pen = false
    points.forEach((p, i) => {
      if (p[key] == null) { pen = false; return }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`
      pen = true
    })
    return d
  }

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  const labelIdx = [0, Math.floor((n - 1) / 3), Math.floor((2 * (n - 1)) / 3), n - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stat-svg" role="img" aria-label={label}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="stat-svg-grid" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="stat-svg-label">{Math.round(t)}</text>
        </g>
      ))}
      {labelIdx.map((i) => (
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="stat-svg-label">{shortDate(points[i].date)}</text>
      ))}
      <path d={path('sarima')} fill="none" stroke={COLORS.sarima} strokeWidth="1.5" strokeDasharray="4 3" />
      <path d={path('xgb')} fill="none" stroke={COLORS.xgb} strokeWidth="2.2" />
    </svg>
  )
}

function SlotChart({ slots, label }) {
  const W = 640
  const H = 240
  const pad = { l: 40, r: 12, t: 12, b: 28 }
  const max = niceMax(Math.max(...slots.flatMap((s) => [s.actual, s.XGBoost, s.SARIMA])))
  const groupW = (W - pad.l - pad.r) / slots.length
  const barW = Math.min(26, groupW / 4)
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max)
  const series = [['actual', COLORS.actual], ['XGBoost', COLORS.xgb], ['SARIMA', COLORS.sarima]]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stat-svg" role="img" aria-label={label}>
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t * max)} y2={y(t * max)} className="stat-svg-grid" />
          <text x={pad.l - 6} y={y(t * max) + 4} textAnchor="end" className="stat-svg-label">{Math.round(t * max)}</text>
        </g>
      ))}
      {slots.map((s, i) => {
        const cx = pad.l + groupW * i + groupW / 2
        return (
          <g key={s.delivery_date}>
            {series.map(([key, color], j) => (
              <rect
                key={key}
                x={cx + (j - 1.5) * barW}
                y={y(s[key])}
                width={barW - 2}
                height={y(0) - y(s[key])}
                rx="3"
                fill={color}
              />
            ))}
            <text x={cx} y={H - 8} textAnchor="middle" className="stat-svg-label">{shortDate(s.delivery_date)}</text>
          </g>
        )
      })}
    </svg>
  )
}

function Legend({ items }) {
  return (
    <div className="stat-legend">
      {items.map(([name, color]) => (
        <span key={name}><i style={{ background: color }} />{name}</span>
      ))}
    </div>
  )
}

// ─── Panel utama tab Statistik ───────────────────────────────────────────────

function ModelStatistics() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [sku, setSku] = useState('TW001')
  const [slots, setSlots] = useState([])
  const [liveDate, setLiveDate] = useState('')
  const [live, setLive] = useState(null)
  const [liveError, setLiveError] = useState('')
  const [liveLoading, setLiveLoading] = useState(false)

  useEffect(() => {
    let active = true
    getXgboostStatistics()
      .then((d) => { if (active) setData(d) })
      .catch((err) => {
        if (active) setError(err.code === 'NETWORK_ERROR' ? 'Tidak dapat terhubung ke server.' : err.message ?? 'Gagal memuat statistik model')
      })
    getSlots({ count: 6 })
      .then((list) => { if (active) setSlots(list ?? []) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  async function runLive() {
    const date = liveDate || slots[0]?.delivery_date
    if (!date) return
    setLiveLoading(true)
    setLiveError('')
    setLive(null)
    try {
      setLive(await getLiveForecast(date))
    } catch (err) {
      setLiveError(err.code === 'MODEL_SERVICE_NOT_CONFIGURED'
        ? 'Layanan forecast belum dihubungkan (FORECAST_API_URL kosong). Tabel di atas memakai snapshot dari notebook.'
        : err.message ?? 'Gagal menghitung prediksi')
    } finally {
      setLiveLoading(false)
    }
  }

  if (error) return <Alert severity="error" className="admin-auth-alert">{error}</Alert>
  if (!data) return <p className="muted">Memuat statistik model…</p>

  const { forecast, slot_forecast: slot, backtest } = data
  const skuRows = forecast.per_sku
  const selected = skuRows.find((r) => r.sku_id === sku) ?? skuRows[0]
  const points = (backtest.daily_series[selected.sku_id] ?? []).map(([date, actual, xgb, sarima]) => ({ date, actual, xgb, sarima }))

  return (
    <div className="model-stats">
      {data.is_simulation && (
        <Alert severity="info" className="admin-auth-alert">
          Mode simulasi. {data.data_note}
        </Alert>
      )}

      {slots.length > 0 && (
        <section className="statistics-chart-slot">
          <h2 className="stat-heading">Prediksi untuk slot mendatang</h2>
          <p className="muted">Dihitung langsung oleh model di layanan Python, memakai data aktual terbaru.</p>
          <label className="stat-select">
            <span>Tanggal</span>
            <select value={liveDate || slots[0].delivery_date} onChange={(e) => setLiveDate(e.target.value)}>
              {slots.map((sl) => <option key={sl.delivery_date} value={sl.delivery_date}>{fmtDate(sl.delivery_date, true)}</option>)}
            </select>
          </label>{' '}
          <button type="button" className="stat-button" onClick={runLive} disabled={liveLoading}>
            {liveLoading ? 'Menghitung…' : 'Hitung prediksi'}
          </button>
          {liveError && <Alert severity="warning" sx={{ mt: 1.5 }}>{liveError}</Alert>}
          {live && (
            <>
              <p className="muted" style={{ marginTop: 12 }}>
                Untuk {fmtDate(live.target_date, true)}, data sampai {fmtDate(live.forecast_origin)}.
                Total {nf1.format(live.demand_by_sku.reduce((a, r) => a + r.forecast_units, 0))} unit.
              </p>
              <BarChart
                rows={live.demand_by_sku.map((r) => ({ key: r.sku_id, label: skuLabel(r), value: r.forecast_units }))}
                label="Prediksi permintaan per SKU untuk slot terpilih"
              />
            </>
          )}
        </section>
      )}

      <section className="statistics-chart-slot">
        <h2 className="stat-heading">Prediksi (backtest)</h2>
        <p className="muted">
          {fmtDate(backtest.daily_from)} – {fmtDate(backtest.daily_to)}.
        </p>
        <label className="stat-select">
          <span>SKU</span>
          <select value={selected.sku_id} onChange={(e) => setSku(e.target.value)}>
            {skuRows.map((r) => <option key={r.sku_id} value={r.sku_id}>{skuLabel(r)}</option>)}
          </select>
        </label>
        <LineChart points={points} label={`Prediksi ${skuLabel(selected)}`} />
        <Legend items={[['XGBoost', COLORS.xgb], ['SARIMA', COLORS.sarima]]} />
      </section>

      {backtest.slot_series.length > 0 && (
        <section className="statistics-chart-slot">
          <h2 className="stat-heading">Total per slot pengiriman</h2>
          <p className="muted">
            Selasa dan Jumat, simulasi cutoff pesanan H-{slot?.order_cutoff_days ?? 1}. Hanya slot dengan data aktual lengkap
            ({backtest.slot_series.length} slot).
          </p>
          <SlotChart slots={backtest.slot_series} label="Total aktual dan prediksi per slot pengiriman" />
          <Legend items={[['Aktual', COLORS.actual], ['XGBoost', COLORS.xgb], ['SARIMA', COLORS.sarima]]} />
        </section>
      )}

      {slot && (
        <section className="statistics-chart-slot">
          <h2 className="stat-heading">Estimasi kebutuhan slot {fmtDate(slot.delivery_date, true)}</h2>
          <p className="muted">
            Pesanan masuk {fmtDate(slot.order_window_start)} – {fmtDate(slot.order_window_end)}. Total {nf1.format(slot.total_units)} unit.
          </p>
          <div className="stat-table-wrap">
            <table className="stat-table">
              <thead>
                <tr><th>SKU</th><th>Prediksi harian</th><th>Estimasi slot</th></tr>
              </thead>
              <tbody>
                {skuRows.map((r) => (
                  <tr key={r.sku_id}>
                    <td>{skuLabel(r)}</td>
                    <td>{nf1.format(r.forecast_units)}</td>
                    <td>{r.slot_units == null ? '–' : nf1.format(r.slot_units)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}


    </div>
  )
}

export default ModelStatistics
