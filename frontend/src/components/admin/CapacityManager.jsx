import { useEffect, useState } from 'react'
import { Alert, Button, Paper, Switch, TextField, Typography } from '@mui/material'
import {
  deleteSlotOverride,
  getSlotsConfig,
  overrideSlotCapacity,
  updateDeliveryDay,
} from '../../services/api'

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // tampil Senin lebih dulu
const MAX_CAPACITY = 1_000_000

function formatDelivery(iso) {
  const d = new Date(`${iso}T00:00:00`)
  const weekday = new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(d)
  const date = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(d)
  return `${weekday}, ${date}`
}

// Mengembalikan angka bulat 0..1.000.000, atau null jika tidak valid (sama dengan aturan backend).
function parseCapacity(text) {
  const t = String(text ?? '').trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return n <= MAX_CAPACITY ? n : null
}

const CAPACITY_HINT = `Isi angka bulat 0 sampai ${new Intl.NumberFormat('id-ID').format(MAX_CAPACITY)}`

function errorText(err) {
  return err.code === 'NETWORK_ERROR' ? 'Tidak dapat terhubung ke server.' : err.message ?? 'Gagal menyimpan'
}

// Kapasitas slot: default per hari pengiriman dan pengecualian (override) per tanggal.
// `slots` datang dari dashboard; onChanged() memuat ulang data dashboard setelah perubahan.
function CapacityManager({ slots, onChanged }) {
  const [config, setConfig] = useState(null)
  const [configError, setConfigError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const [drafts, setDrafts] = useState({}) // weekday -> { capacity, active }
  const [dayErrors, setDayErrors] = useState({})
  const [slotEdit, setSlotEdit] = useState(null) // { date, value, error }
  const [newDay, setNewDay] = useState({ weekday: '', capacity: '' })
  const [newDayError, setNewDayError] = useState('')

  useEffect(() => {
    let active = true
    getSlotsConfig()
      .then((c) => {
        if (!active) return
        setConfig(c)
        setConfigError('')
      })
      .catch((err) => {
        if (active) setConfigError(errorText(err))
      })
    return () => {
      active = false
    }
  }, [reloadKey])

  async function afterChange(message) {
    setNotice(message)
    setError('')
    setReloadKey((k) => k + 1)
    await onChanged()
  }

  const days = config ? [...config.days].sort((a, b) => DAY_ORDER.indexOf(a.weekday) - DAY_ORDER.indexOf(b.weekday)) : []
  const overrideDates = new Set((config?.overrides ?? []).map((o) => o.delivery_date))
  const missingWeekdays = DAY_ORDER.filter((w) => !days.some((d) => d.weekday === w))
  const draftOf = (day) => drafts[day.weekday] ?? { capacity: String(day.capacity), active: day.active }
  const setDraft = (day, patch) => setDrafts((d) => ({ ...d, [day.weekday]: { ...draftOf(day), ...patch } }))

  // Slot mendatang pada hari ini (tanpa override) yang sudah terisi lebih banyak dari kapasitas baru.
  function overfilled(weekday, capacity) {
    if (capacity === null) return []
    return slots.filter((s) => s.weekday === weekday && !overrideDates.has(s.delivery_date) && s.used > capacity)
  }

  async function saveDay(day) {
    const draft = draftOf(day)
    const capacity = parseCapacity(draft.capacity)
    if (capacity === null) {
      setDayErrors((e) => ({ ...e, [day.weekday]: CAPACITY_HINT }))
      return
    }
    setDayErrors((e) => ({ ...e, [day.weekday]: '' }))
    setBusy(`day-${day.weekday}`)
    try {
      await updateDeliveryDay(day.weekday, { capacity, active: draft.active })
      setDrafts((d) => {
        const next = { ...d }
        delete next[day.weekday]
        return next
      })
      await afterChange(`Hari ${DAY_NAMES[day.weekday]} disimpan.`)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy('')
    }
  }

  async function addDay() {
    const capacity = parseCapacity(newDay.capacity)
    if (newDay.weekday === '' || capacity === null) {
      setNewDayError(newDay.weekday === '' ? 'Pilih harinya' : CAPACITY_HINT)
      return
    }
    setNewDayError('')
    setBusy('new-day')
    try {
      await updateDeliveryDay(Number(newDay.weekday), { capacity, active: true })
      setNewDay({ weekday: '', capacity: '' })
      await afterChange(`Hari ${DAY_NAMES[Number(newDay.weekday)]} ditambahkan sebagai hari pengiriman.`)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy('')
    }
  }

  async function saveOverride(slot) {
    const capacity = parseCapacity(slotEdit.value)
    if (capacity === null) {
      setSlotEdit((s) => ({ ...s, error: CAPACITY_HINT }))
      return
    }
    if (capacity < slot.used) {
      setSlotEdit((s) => ({ ...s, error: `Tidak boleh di bawah jumlah roti yang sudah dipesan (${slot.used})` }))
      return
    }
    setBusy(`slot-${slot.delivery_date}`)
    try {
      await overrideSlotCapacity(slot.delivery_date, capacity)
      setSlotEdit(null)
      await afterChange(`Kapasitas ${formatDelivery(slot.delivery_date)} diubah menjadi ${capacity} roti.`)
    } catch (err) {
      // Mis. BELOW_USED jika ada order masuk sesaat sebelumnya.
      setSlotEdit((s) => ({ ...s, error: errorText(err) }))
    } finally {
      setBusy('')
    }
  }

  async function resetOverride(slot) {
    setBusy(`slot-${slot.delivery_date}`)
    try {
      await deleteSlotOverride(slot.delivery_date)
      await afterChange(`Kapasitas ${formatDelivery(slot.delivery_date)} kembali ke default.`)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy('')
    }
  }

  return (
    <Paper className="order-card admin-card" elevation={0}>
      <Typography component="h1" className="admin-title">Kapasitas pengiriman</Typography>
      <p className="muted">Slot yang penuh otomatis tidak bisa dipilih customer.</p>

      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <h2 className="capacity-subheading">Slot mendatang</h2>
      <div className="capacity-list">
        {slots.map((slot) => {
          const pct = slot.capacity > 0 ? Math.min(100, (slot.used / slot.capacity) * 100) : 100
          const editing = slotEdit?.date === slot.delivery_date
          const isOverride = overrideDates.has(slot.delivery_date)
          const slotBusy = busy === `slot-${slot.delivery_date}`
          return (
            <div className="capacity-item" key={slot.delivery_date}>
              <div className="capacity-heading">
                <strong>
                  {formatDelivery(slot.delivery_date)}
                  {isOverride && <span className="product-badge capacity-badge">Diubah manual</span>}
                </strong>
                <span>{slot.used}/{slot.capacity} roti</span>
              </div>
              <div
                className="capacity-track"
                role="progressbar"
                aria-label={`Kapasitas ${formatDelivery(slot.delivery_date)}`}
                aria-valuenow={slot.used}
                aria-valuemin={0}
                aria-valuemax={slot.capacity}
              >
                <span style={{ width: `${pct}%` }} />
              </div>
              <p className="muted">
                {slot.status === 'full' ? 'Penuh' : `Sisa ${slot.left} roti`}
              </p>
              {editing ? (
                <div className="capacity-edit">
                  <TextField
                    size="small"
                    label="Kapasitas baru (roti)"
                    value={slotEdit.value}
                    onChange={(e) => setSlotEdit((s) => ({ ...s, value: e.target.value, error: '' }))}
                    error={Boolean(slotEdit.error)}
                    helperText={slotEdit.error || `Minimal ${slot.used} (sudah dipesan)`}
                    slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                  />
                  <Button variant="contained" size="small" onClick={() => saveOverride(slot)} disabled={slotBusy}>
                    {slotBusy ? 'Menyimpan...' : 'Simpan'}
                  </Button>
                  <Button size="small" onClick={() => setSlotEdit(null)} disabled={slotBusy}>Batal</Button>
                </div>
              ) : (
                <div className="capacity-actions">
                  <Button size="small" onClick={() => setSlotEdit({ date: slot.delivery_date, value: String(slot.capacity), error: '' })}>
                    Ubah kapasitas
                  </Button>
                  {isOverride && (
                    <Button size="small" onClick={() => resetOverride(slot)} disabled={slotBusy}>
                      Kembalikan ke default
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {slots.length === 0 && <p className="empty-state">Belum ada slot mendatang. Tambahkan hari pengiriman di bawah.</p>}
      </div>

      <h2 className="capacity-subheading">Hari pengiriman dan kapasitas default</h2>
      <p className="muted">
        Berlaku untuk semua tanggal pada hari itu, kecuali yang diubah manual. Hari yang dinonaktifkan tidak muncul di form
        pemesanan; order yang sudah masuk tetap tersimpan.
      </p>
      {configError && <Alert severity="error" sx={{ mb: 2 }}>{configError}</Alert>}
      {!config && !configError && <p className="muted">Memuat pengaturan…</p>}
      {config && (
        <div className="capacity-days">
          {days.map((day) => {
            const draft = draftOf(day)
            const parsed = parseCapacity(draft.capacity)
            const changed = draft.capacity.trim() !== String(day.capacity) || draft.active !== day.active
            const over = overfilled(day.weekday, parsed)
            return (
              <div className="capacity-day-row" key={day.weekday}>
                <strong>{DAY_NAMES[day.weekday]}</strong>
                <TextField
                  size="small"
                  label="Kapasitas (roti)"
                  value={draft.capacity}
                  onChange={(e) => setDraft(day, { capacity: e.target.value })}
                  error={Boolean(dayErrors[day.weekday])}
                  helperText={dayErrors[day.weekday] || (over.length ? `${over.map((s) => formatDelivery(s.delivery_date)).join(', ')} sudah terisi melebihi angka ini; slot itu akan penuh.` : ' ')}
                  slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                />
                <label className="capacity-switch">
                  <Switch checked={draft.active} onChange={(e) => setDraft(day, { active: e.target.checked })} />
                  <span>{draft.active ? 'Aktif' : 'Nonaktif'}</span>
                </label>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => saveDay(day)}
                  disabled={!changed || busy === `day-${day.weekday}`}
                >
                  {busy === `day-${day.weekday}` ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </div>
            )
          })}

          {missingWeekdays.length > 0 && (
            <div className="capacity-day-row capacity-day-new">
              <select
                aria-label="Hari pengiriman baru"
                value={newDay.weekday}
                onChange={(e) => setNewDay((n) => ({ ...n, weekday: e.target.value }))}
              >
                <option value="">Tambah hari…</option>
                {missingWeekdays.map((w) => <option key={w} value={w}>{DAY_NAMES[w]}</option>)}
              </select>
              <TextField
                size="small"
                label="Kapasitas (roti)"
                value={newDay.capacity}
                onChange={(e) => setNewDay((n) => ({ ...n, capacity: e.target.value }))}
                error={Boolean(newDayError)}
                helperText={newDayError || ' '}
                slotProps={{ htmlInput: { inputMode: 'numeric' } }}
              />
              <span />
              <Button variant="outlined" size="small" onClick={addDay} disabled={busy === 'new-day'}>
                {busy === 'new-day' ? 'Menambah...' : 'Tambah'}
              </Button>
            </div>
          )}
        </div>
      )}
    </Paper>
  )
}

export default CapacityManager
