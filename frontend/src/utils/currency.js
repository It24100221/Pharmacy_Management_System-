// Currency formatting utilities for Sri Lankan Rupees (LKR)
export const currencyFormatter = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return 'Rs. 0.00'
  }
  return `LKR ${Number(amount).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export const parseCurrency = (value) => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    // Remove currency symbols and commas
    const cleaned = value.replace(/[Rs.,\s]/g, '')
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }
  return 0
}

export const calculateTotal = (price, quantity) => {
  return Math.round(price * quantity * 100) / 100 // Round to 2 decimal places
}

export const calculateGrandTotal = (items, discount = 0) => {
  const subtotal = items.reduce((sum, item) => {
    return sum + (item.line_total || (item.unit_price * item.quantity))
  }, 0)
  return Math.round((subtotal - discount) * 100) / 100
}
