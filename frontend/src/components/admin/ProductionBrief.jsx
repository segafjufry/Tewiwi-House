import { useEffect, useState } from 'react'
import { Alert, Button, Paper, Typography } from '@mui/material'
import { generateBrief, getProductionSummary } from '../../services/api'

const nf = new Intl.NumberFormat('id-ID')

function formatDelivery(iso) {
  const d = new Date(`${iso}T00:00:00`)
  const weekday = new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(d)
  const date = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
  return `${weekday}, ${date}`
}

function errorText(err) {
  return err.code === 'NETWORK_ERROR' ? 'Tidak dapat terhubung ke server.' : err.message ?? 'Terjadi kesalahan'
}

// Ringkasan produksi untuk satu slot (order terkonfirmasi + prediksi) dan production brief
// (Generative AI jika server punya ANTHROPIC_API_KEY, selain itu template).
function ProductionBrief({ slots }) {
  const [picked, setPicked] = useState(null)
  const [summary, setSummary] = useState(null)
  const [summaryError, setSummaryError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [brief, setBrief] = useState(null)
  const [briefError, setBriefError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const date = picked ?? slots[0]?.delivery_date ?? null

  useEffect(() => {
    if (!date) return undefined
    let active = true
    getProductionSummary(date)
      .then((d) => {
        if (!active) return
        setSummary(d)
        setSummaryError('')
      })
      .catch((err) => {
        if (active) setSummaryError(errorText(err))
      })
    return () => {
      active = false
    }
  }, [date, reloadKey])

  function resetResults() {
    setBrief(null)
    setBriefError('')
    setCopied(false)
    setSummaryError('')
  }

  function handlePick(event) {
    setPicked(event.target.value)
    resetResults()
  }

  function handleReload() {
    resetResults()
    setReloadKey((k) => k + 1)
  }

  async function handleGenerate() {
    setGenerating(true)
    setBriefError('')
    setCopied(false)
    try {
      const result = await generateBrief(date)
      setBrief(result)
      setSummary(result.data) // brief dan tabel dari data yang sama
    } catch (err) {
      setBriefError(errorText(err))
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(brief.brief)
      setCopied(true)
    } catch {
      setBriefError('Tidak bisa menyalin otomatis. Pilih teks lalu salin manual.')
    }
  }

  const loading = !summaryError && summary?.delivery_date !== date
  const shown = summary?.delivery_date === date ? summary : null

  return (
    <Paper className="order-card admin-card brief-card" elevation={0}>
      <div className="admin-section-heading">
        <div>
          <Typography component="h1" className="admin-title">Production brief</Typography>
          <p className="muted">Target dihitung dari order terkonfirmasi dan prediksi permintaan (WMA).</p>
        </div>
        {slots.length > 0 && (
          <label className="stat-select">
            <span>Slot</span>
            <select value={date ?? ''} onChange={handlePick}>
              {slots.map((s) => (
                <option key={s.delivery_date} value={s.delivery_date}>{formatDelivery(s.delivery_date)}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {slots.length === 0 && <p className="empty-state">Belum ada slot pengiriman mendatang.</p>}
      {summaryError && <Alert severity="error" sx={{ mt: 2 }}>{summaryError}</Alert>}
      {loading && !summaryError && date && <p className="muted">Memuat ringkasan…</p>}

      {shown && (
        <>
          <p className="muted" style={{ marginTop: 12 }}>
            Mulai produksi {formatDelivery(shown.production_start)}. Kapasitas terisi {shown.used}/{shown.capacity} roti.
            {' '}Terkonfirmasi {shown.confirmed_qty} roti dari {shown.order_count} order.
          </p>

          {shown.warnings.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <ul className="brief-warnings">
                {shown.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </Alert>
          )}

          <div className="stat-table-wrap">
            <table className="stat-table">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Terkonfirmasi</th>
                  <th>Belum konfirmasi</th>
                  <th>Prediksi</th>
                  <th>Target</th>
                  <th>Tepung (kg)</th>
                </tr>
              </thead>
              <tbody>
                {shown.items.map((i) => (
                  <tr key={i.product_id}>
                    <td>{i.name}</td>
                    <td>{i.ordered}</td>
                    <td>{i.pending}</td>
                    <td>{i.predicted}</td>
                    <td><strong>{i.target}</strong></td>
                    <td>{nf.format(i.flour_kg)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td>{shown.confirmed_qty}</td>
                  <td>{shown.pending_qty}</td>
                  <td />
                  <td><strong>{shown.total_target}</strong></td>
                  <td>{nf.format(shown.flour_kg)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      <div className="brief-actions">
        <Button variant="contained" onClick={handleGenerate} disabled={!date || generating || loading}>
          {generating ? 'Membuat brief…' : 'Buat production brief'}
        </Button>
        <Button onClick={handleReload} disabled={!date || generating}>Muat ulang data</Button>
      </div>

      {briefError && <Alert severity="error" sx={{ mt: 2 }}>{briefError}</Alert>}

      {brief && (
        <div className="brief-result">
          <div className="admin-section-heading">
            <span className={`product-badge${brief.source === 'llm' ? ' is-active' : ''}`}>
              {brief.source === 'llm' ? 'Dibuat oleh Generative AI' : 'Template (AI tidak aktif)'}
            </span>
            <Button size="small" onClick={handleCopy}>{copied ? 'Tersalin' : 'Salin teks'}</Button>
          </div>
          <pre className="brief-text">{brief.brief}</pre>
        </div>
      )}
    </Paper>
  )
}

export default ProductionBrief
