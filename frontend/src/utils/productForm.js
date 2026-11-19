// Validasi form produk. Aturannya sama dengan backend (routes/products.js, utils/validate.js),
// jadi pesan galat muncul di form sebelum request dikirim.

export const emptyProductForm = {
  name: '',
  price: '',
  flour_grams: '0',
  description: '',
  image_url: '',
  active: true,
}

export function formFromProduct(p) {
  return {
    name: p.name ?? '',
    price: String(p.price ?? ''),
    flour_grams: String(p.flour_grams ?? 0),
    description: p.description ?? '',
    image_url: p.image_url ?? '',
    active: Boolean(p.active),
  }
}

const MAX_INT = 1_000_000

function parseInteger(value, label, errors, key) {
  const text = String(value ?? '').trim()
  if (!/^\d+$/.test(text)) {
    errors[key] = `${label} harus berupa angka bulat 0 atau lebih`
    return null
  }
  const n = Number(text)
  if (n > MAX_INT) {
    errors[key] = `${label} maksimal ${new Intl.NumberFormat('id-ID').format(MAX_INT)}`
    return null
  }
  return n
}

/** Mengembalikan { errors, payload }. payload hanya valid jika errors kosong. */
export function validateProductForm(form) {
  const errors = {}
  const name = form.name.trim()
  if (!name) errors.name = 'Nama produk wajib diisi'
  else if (name.length > 100) errors.name = 'Nama maksimal 100 karakter'

  const price = parseInteger(form.price, 'Harga', errors, 'price')
  const flour = parseInteger(form.flour_grams, 'Tepung', errors, 'flour_grams')

  const description = form.description.trim()
  if (description.length > 500) errors.description = 'Deskripsi maksimal 500 karakter'

  const imageUrl = form.image_url.trim()
  if (imageUrl.length > 500) errors.image_url = 'URL gambar maksimal 500 karakter'
  else if (imageUrl && !/^(https?:\/\/|\/)/i.test(imageUrl)) {
    errors.image_url = 'URL gambar harus diawali http://, https://, atau /'
  }

  return {
    errors,
    payload: {
      name,
      price,
      flour_grams: flour,
      description,
      image_url: imageUrl,
      active: Boolean(form.active),
    },
  }
}
