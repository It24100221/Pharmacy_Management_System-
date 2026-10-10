export const isValidSupplierPhone = phone => {
  const value = String(phone ?? '').trim()
  if (!value) return true
  return /^\d{10}$/.test(value)
}

export const SUPPLIER_PHONE_ERROR = 'Phone number must contain exactly 10 digits'
