import paketAlitImage from '../assets/paket-alit.jpg'
import countryBreadImage from '../assets/country-bread.jpg'
import koreanGarlicImage from '../assets/korean-garlic-creamcheese.jpg'
import dustyChocoImage from '../assets/dusty-choco-hazelnut.jpg'
import blueberryCheeseImage from '../assets/blueberry-cheese-crumble.jpg'
import espressoBrowniesImage from '../assets/espresso-fudgy-brownies.jpg'
import espressoBrowniesSmallImage from '../assets/espresso-fudgy-brownies-s.jpg'
import shokupanImage from '../assets/shokupan-loaf.jpg'
import saltBreadImage from '../assets/salt-bread.jpg'
import seiCheeseSaltBreadImage from '../assets/sei-cheese-salt-bread.jpg'
import cranberryWalnutImage from '../assets/cranberry-walnut-creamcheese.jpg'

export function isPaketAlitProduct(product) {
  return /^paket alit(?:\b|$)/i.test(product.name?.trim() ?? '')
}

export function isCountryBreadProduct(product) {
  return /^country bread(?:\b|$)/i.test(product.name?.trim() ?? '')
}

export function isKoreanGarlicProduct(product) {
  return /^korean garlic(?:\b|$)/i.test(product.name?.trim() ?? '')
}

export function isDustyChocoProduct(product) {
  return /^dusty choco(?:\b|$)/i.test(product.name?.trim() ?? '')
}

export function isBlueberryCheeseProduct(product) {
  return /^blueberry cheese(?:\b|$)/i.test(product.name?.trim() ?? '')
}

export function isEspressoBrowniesProduct(product) {
  return /^espresso fudgy brownies(?:\b|$)/i.test(product.name?.trim() ?? '')
}

export function isEspressoBrowniesSmallProduct(product) {
  return /^espresso fudgy brownies\s+s(?:\b|$)/i.test(product.name?.trim() ?? '')
}

export function isShokupanProduct(product) {
  return /^shokupan loaf(?:\b|$)/i.test(product.name?.trim() ?? '')
}

export function isSaltBreadProduct(product) {
  return /\bsalt bread\b/i.test(product.name?.trim() ?? '')
}

export function isSeiCheeseSaltBreadProduct(product) {
  return /^sei cheese salt bread(?:\b|$)/i.test(product.name?.trim() ?? '')
}

export function isCranberryWalnutProduct(product) {
  return /^cranberry walnut(?:\b|$)/i.test(product.name?.trim() ?? '')
}

export function getProductImage(product, fallbackImage) {
  if (isPaketAlitProduct(product)) return paketAlitImage
  if (isCountryBreadProduct(product)) return countryBreadImage
  if (isKoreanGarlicProduct(product)) return koreanGarlicImage
  if (isDustyChocoProduct(product)) return dustyChocoImage
  if (isBlueberryCheeseProduct(product)) return blueberryCheeseImage
  if (isEspressoBrowniesSmallProduct(product)) return espressoBrowniesSmallImage
  if (isEspressoBrowniesProduct(product)) return espressoBrowniesImage
  if (isShokupanProduct(product)) return shokupanImage
  if (isSeiCheeseSaltBreadProduct(product)) return seiCheeseSaltBreadImage
  if (isSaltBreadProduct(product)) return saltBreadImage
  if (isCranberryWalnutProduct(product)) return cranberryWalnutImage
  return product.image_url || fallbackImage
}

// Penjelasan cadangan jika kolom description di database masih kosong
// (produk lama diberi nilai kosong oleh migrasi 007).
const FALLBACK_DESCRIPTIONS = [
  [/^paket alit/i, 'Paket assortmen berisi berbagai varian roti signature Tewiwi.'],
  [/^country bread/i, 'Roti country bread artisan dengan kulit tebal dan remah yang kenyal.'],
  [/^korean garlic/i, 'Roti garlic ala Korea dengan filling creamcheese yang gurih dan creamy.'],
  [/^dusty choco/i, 'Roti berlapis cokelat dan hazelnut dengan taburan dusty sugar.'],
  [/^blueberry cheese/i, 'Roti dengan isian blueberry, taburan keju, dan crumble renyah di atasnya.'],
  [/^espresso fudgy brownies/i, 'Brownies fudgy dengan rasa espresso, padat dan lembap.'],
  [/^shokupan loaf/i, 'Roti tawar Jepang (shokupan) yang lembut, empuk, dan serbaguna.'],
  [/^cranberry walnut/i, 'Roti creamcheese dengan cranberry asam dan kacang walnut yang renyah.'],
  [/\bsalt bread\b/i, 'Salt bread dengan kulit renyah dan bagian dalam yang empuk.'],
]

export function getProductDescription(product) {
  const text = product.description?.trim()
  if (text) return text
  const name = product.name?.trim() ?? ''
  const match = FALLBACK_DESCRIPTIONS.find(([pattern]) => pattern.test(name))
  return match ? match[1] : 'Dipanggang segar sesuai pesananmu.'
}
