import { useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Paper,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import sourdoughImage from '../../assets/sourdough.jpg'
import { getProductImage } from '../../utils/productImage'
import { createProduct, deleteProduct, updateProduct } from '../../services/api'
import { emptyProductForm, formFromProduct, validateProductForm } from '../../utils/productForm'
import { rupiah } from '../../utils/formatCurrency'

// CRUD produk untuk admin. Daftar datang dari dashboard (termasuk produk nonaktif);
// setelah setiap perubahan, onChanged() memuat ulang data dashboard.
function ProductManager({ products, onChanged }) {
  const [notice, setNotice] = useState('')
  const [pageError, setPageError] = useState('')
  const [busyId, setBusyId] = useState(null)

  // Dialog tambah/ubah
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null) // null = produk baru
  const [form, setForm] = useState(emptyProductForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Dialog hapus
  const [toDelete, setToDelete] = useState(null)
  const [deleteError, setDeleteError] = useState(null) // { code, message }
  const [deleting, setDeleting] = useState(false)

  function openCreate() {
    setEditing(null)
    setForm(emptyProductForm)
    setFieldErrors({})
    setSubmitError('')
    setFormOpen(true)
  }

  function openEdit(product) {
    setEditing(product)
    setForm(formFromProduct(product))
    setFieldErrors({})
    setSubmitError('')
    setFormOpen(true)
  }

  function closeForm() {
    if (!submitting) setFormOpen(false)
  }

  const setField = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    const { errors, payload } = validateProductForm(form)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    setSubmitError('')
    try {
      if (editing) await updateProduct(editing.id, payload)
      else await createProduct(payload)
      setFormOpen(false)
      setPageError('')
      setNotice(editing ? `Produk "${payload.name}" diperbarui.` : `Produk "${payload.name}" ditambahkan.`)
      await onChanged()
    } catch (err) {
      setSubmitError(err.code === 'NETWORK_ERROR' ? 'Tidak dapat terhubung ke server.' : err.message ?? 'Gagal menyimpan produk')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(product) {
    setBusyId(product.id)
    setNotice('')
    setPageError('')
    try {
      await updateProduct(product.id, { active: !product.active })
      setNotice(`Produk "${product.name}" ${product.active ? 'dinonaktifkan' : 'diaktifkan'}.`)
      await onChanged()
    } catch (err) {
      setPageError(err.message ?? 'Gagal mengubah status produk')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteProduct(toDelete.id)
      setNotice(`Produk "${toDelete.name}" dihapus.`)
      setPageError('')
      setToDelete(null)
      await onChanged()
    } catch (err) {
      setDeleteError({ code: err.code, message: err.message ?? 'Gagal menghapus produk' })
    } finally {
      setDeleting(false)
    }
  }

  async function deactivateInstead() {
    const product = toDelete
    setToDelete(null)
    setDeleteError(null)
    await handleToggleActive({ ...product, active: true })
  }

  return (
    <Paper className="order-card admin-card" elevation={0}>
      <div className="admin-section-heading">
        <div>
          <Typography component="h1" className="admin-title">Produk</Typography>
          <p className="muted">Produk nonaktif tidak tampil di form pemesanan customer.</p>
        </div>
        <Button variant="contained" onClick={openCreate}>Tambah produk</Button>
      </div>

      {notice && <Alert severity="success" sx={{ mt: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
      {pageError && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setPageError('')}>{pageError}</Alert>}

      {products.length === 0 ? (
        <p className="empty-state">Belum ada produk. Tambahkan produk pertama.</p>
      ) : (
        <div className="product-admin-list">
          {products.map((product) => (
            <div className={`product-admin-item${product.active ? '' : ' is-inactive'}`} key={product.id}>
              <img src={getProductImage(product, sourdoughImage)} alt="" />
              <div className="product-admin-info">
                <strong>{product.name}</strong>
                <span>
                  {rupiah(product.price)} · tepung {product.flour_grams} g/pcs
                </span>
                {product.description && <p className="muted">{product.description}</p>}
                <span className={`product-badge${product.active ? ' is-active' : ''}`}>
                  {product.active ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <div className="product-admin-actions">
                <Button size="small" onClick={() => openEdit(product)}>Ubah</Button>
                <Button size="small" onClick={() => handleToggleActive(product)} disabled={busyId === product.id}>
                  {product.active ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
                <Button
                  size="small"
                  color="error"
                  onClick={() => { setDeleteError(null); setToDelete(product) }}
                >
                  Hapus
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onClose={closeForm} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Ubah produk' : 'Tambah produk'}</DialogTitle>
        <DialogContent>
          <form onSubmit={handleSubmit} id="product-form" noValidate>
            {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}
            <TextField
              label="Nama produk"
              value={form.name}
              onChange={setField('name')}
              error={Boolean(fieldErrors.name)}
              helperText={fieldErrors.name}
              required
              fullWidth
              sx={{ mt: 1, mb: 2 }}
            />
            <div className="product-form-row">
              <TextField
                label="Harga (Rp)"
                value={form.price}
                onChange={setField('price')}
                error={Boolean(fieldErrors.price)}
                helperText={fieldErrors.price}
                slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                required
                fullWidth
              />
              <TextField
                label="Tepung per pcs (gram)"
                value={form.flour_grams}
                onChange={setField('flour_grams')}
                error={Boolean(fieldErrors.flour_grams)}
                helperText={fieldErrors.flour_grams}
                slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                fullWidth
              />
            </div>
            <TextField
              label="Deskripsi"
              value={form.description}
              onChange={setField('description')}
              error={Boolean(fieldErrors.description)}
              helperText={fieldErrors.description ?? `${form.description.trim().length}/500`}
              multiline
              minRows={2}
              fullWidth
              sx={{ mt: 2 }}
            />
            <TextField
              label="URL gambar"
              value={form.image_url}
              onChange={setField('image_url')}
              error={Boolean(fieldErrors.image_url)}
              helperText={fieldErrors.image_url ?? 'Opsional. Kosongkan untuk memakai gambar bawaan.'}
              fullWidth
              sx={{ mt: 2 }}
            />
            <FormControlLabel
              sx={{ mt: 1 }}
              control={
                <Switch
                  checked={form.active}
                  onChange={(event) => setForm((f) => ({ ...f, active: event.target.checked }))}
                />
              }
              label="Tampilkan di form pemesanan"
            />
          </form>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeForm} disabled={submitting}>Batal</Button>
          <Button type="submit" form="product-form" variant="contained" disabled={submitting}>
            {submitting ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(toDelete)} onClose={() => !deleting && setToDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Hapus produk?</DialogTitle>
        <DialogContent>
          <p>
            "{toDelete?.name}" akan dihapus permanen. Produk yang sudah pernah dipesan tidak bisa dihapus; nonaktifkan saja.
          </p>
          {deleteError && <Alert severity="error">{deleteError.message}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)} disabled={deleting}>Batal</Button>
          {deleteError?.code === 'PRODUCT_IN_USE' ? (
            <Button variant="contained" onClick={deactivateInstead}>Nonaktifkan saja</Button>
          ) : (
            <Button color="error" variant="contained" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Menghapus...' : 'Hapus'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Paper>
  )
}

export default ProductManager
