import paketAlitImage from '../assets/paket-alit.jpg'
import countryBreadImage from '../assets/country-bread.jpg'
import koreanGarlicImage from '../assets/korean-garlic-creamcheese.jpg'
import dustyChocoImage from '../assets/dusty-choco-hazelnut.jpg'
import blueberryCheeseImage from '../assets/blueberry-cheese-crumble.jpg'
import espressoBrowniesImage from '../assets/espresso-fudgy-brownies.jpg'
import shokupanImage from '../assets/shokupan-loaf.jpg'
import saltBreadImage from '../assets/salt-bread.jpg'
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

export function isShokupanProduct(product) {
  return /^shokupan loaf(?:\b|$)/i.test(product.name?.trim() ?? '')
}

export function isSaltBreadProduct(product) {
  return /\bsalt bread\b/i.test(product.name?.trim() ?? '')
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
  if (isEspressoBrowniesProduct(product)) return espressoBrowniesImage
  if (isShokupanProduct(product)) return shokupanImage
  if (isSaltBreadProduct(product)) return saltBreadImage
  if (isCranberryWalnutProduct(product)) return cranberryWalnutImage
  return product.image_url || fallbackImage
}
