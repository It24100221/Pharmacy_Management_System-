export function computeStockStatus(quantity, minStock = 10) {
  const normalizedQuantity = Number(quantity ?? 0)
  const normalizedMinimum = Number(minStock ?? 10)

  if (normalizedQuantity <= 0) return 'out_of_stock'
  if (normalizedQuantity <= normalizedMinimum) return 'low_stock'
  return 'in_stock'
}

export function getExpiryStatus(expiryDate) {
  if (!expiryDate) return 'valid'

  const expiry = new Date(expiryDate)
  if (Number.isNaN(expiry.getTime())) return 'valid'

  const today = new Date()
  const daysUntil = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24))
  if (daysUntil < 0) return 'expired'
  if (daysUntil <= 30) return 'near_expiry'
  return 'valid'
}

export function normalizeMedicine(medicine = {}) {
  const quantity = Number(medicine.quantity ?? 0)
  const minStockLevel = Number(medicine.min_stock_level ?? medicine.minStockLevel ?? 10)
  const expiryDate = medicine.expiry_date ?? medicine.expiryDate ?? ''

  return {
    ...medicine,
    id: Number(medicine.id),
    quantity,
    stockStatus: medicine.stock_status || computeStockStatus(quantity, minStockLevel),
    expiryStatus: medicine.expiry_status || getExpiryStatus(expiryDate),
    unitPrice: Number(medicine.unit_price ?? medicine.unitPrice ?? 0),
    genericName: medicine.generic_name ?? medicine.genericName ?? '',
    batchNumber: medicine.batch_number ?? medicine.batchNumber ?? '',
    minStockLevel,
    expiryDate,
  }
}

export function normalizeSupplier(supplier = {}) {
  return {
    ...supplier,
    id: Number(supplier.id),
    company_name: supplier.company_name ?? supplier.companyName ?? '',
    contact_person: supplier.contact_person ?? supplier.contactPerson ?? '',
  }
}

export function normalizeCustomer(customer = {}) {
  return {
    ...customer,
    id: Number(customer.id),
    first_name: customer.first_name ?? customer.firstName ?? '',
    last_name: customer.last_name ?? customer.lastName ?? '',
    date_of_birth: customer.date_of_birth ?? customer.dateOfBirth ?? '',
  }
}

export function normalizeSale(sale = {}) {
  const id = Number(sale.id)
  const items = (sale.items || []).map(item => {
    const medicineId = Number(item.medicine_id ?? item.medicineId)
    const quantity = Number(item.quantity ?? 0)
    const unitPrice = Number(item.unit_price ?? item.unitPrice ?? 0)

    return {
      ...item,
      medicine_id: Number.isFinite(medicineId) ? medicineId : null,
      medicine_name: item.medicine_name ?? item.medicineName ?? item.name ?? 'Medicine',
      batch_number: item.batch_number ?? item.batchNumber ?? '',
      quantity,
      unit_price: unitPrice,
      line_total: Number(item.line_total ?? item.lineTotal ?? quantity * unitPrice),
    }
  })

  return {
    ...sale,
    id,
    receipt_number: sale.receipt_number || (Number.isFinite(id) ? `REC-${String(id).padStart(6, '0')}` : 'N/A'),
    customer_name: sale.customer_name || sale.customer?.name || (sale.first_name ? `${sale.first_name} ${sale.last_name}` : 'Walk-in Customer'),
    sale_date: sale.sale_date || sale.created_at,
    total: Number(sale.final_amount ?? sale.total ?? sale.total_amount ?? 0),
    subtotal: Number(sale.subtotal ?? sale.total_amount ?? 0),
    discount: Number(sale.discount ?? 0),
    payment_method: sale.payment_method || 'Cash',
    items,
  }
}

export function normalizePrescription(prescription = {}) {
  const customerId = Number(prescription.customer_id ?? prescription.customerId)

  return {
    ...prescription,
    id: Number(prescription.id),
    customer_id: Number.isFinite(customerId) ? customerId : null,
    customer_name: prescription.customer_name || (prescription.first_name ? `${prescription.first_name} ${prescription.last_name}` : 'Customer'),
    status: prescription.status || 'active',
    items: (prescription.items || []).map(item => ({
      ...item,
      medicine_id: Number(item.medicine_id ?? item.medicineId),
      medicine_name: item.medicine_name ?? item.medicineName ?? item.name ?? 'Medicine',
      batch_number: item.batch_number ?? item.batchNumber ?? '',
      quantity: Number(item.quantity ?? item.prescribed_quantity ?? 0),
      unit_price: Number(item.unit_price ?? item.unitPrice ?? 0),
      instructions: item.instructions ?? item.item_instructions ?? '',
    })),
  }
}
