export function isMedicineSellable(medicine) {
  return Number(medicine?.quantity ?? 0) > 0 && medicine?.expiryStatus !== 'expired'
}

export function getSaleValidationError(cart, discount) {
  if (!Array.isArray(cart) || cart.length === 0) {
    return 'Cart is empty. Add medicines before completing sale.'
  }

  const subtotal = cart.reduce((sum, item) => sum + Number(item.lineTotal ?? 0), 0)
  const discountAmount = Number(discount ?? 0)

  if (!Number.isFinite(discountAmount) || discountAmount < 0) {
    return 'Discount must be a valid non-negative amount.'
  }
  if (discountAmount > subtotal) {
    return 'Discount cannot exceed the subtotal.'
  }

  return null
}
