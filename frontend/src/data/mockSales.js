// Mock Sales Data - Senevirathna Medical Pharmacy
export const mockSales = [
  {
    id: 1,
    receipt_number: 'SAL-1001',
    customer_id: 1,
    customer_name: 'Kamal Perera',
    sale_date: '2026-09-09T10:30:00Z',
    items: [
      {
        medicine_id: 1,
        medicine_name: 'Amoxicillin 500mg Capsules',
        batch_number: 'AMX-2024-001',
        quantity: 14,
        unit_price: 2500,
        line_total: 35000
      },
      {
        medicine_id: 8,
        medicine_name: 'Ibuprofen 400mg Tablets',
        batch_number: 'IBU-2024-008',
        quantity: 10,
        unit_price: 950,
        line_total: 9500
      }
    ],
    subtotal: 44500,
    discount: 0,
    total: 44500,
    payment_method: 'Cash',
    notes: '',
    created_at: '2026-09-09T10:30:00Z'
  },
  {
    id: 2,
    receipt_number: 'SAL-1002',
    customer_id: 3,
    customer_name: 'Sunil Wickramasinghe',
    sale_date: '2026-09-09T14:15:00Z',
    items: [
      {
        medicine_id: 2,
        medicine_name: 'Paracetamol 500mg Tablets',
        batch_number: 'PCM-2024-002',
        quantity: 20,
        unit_price: 850,
        line_total: 17000
      },
      {
        medicine_id: 5,
        medicine_name: 'Cetirizine 10mg Tablets',
        batch_number: 'CTZ-2024-005',
        quantity: 10,
        unit_price: 650,
        line_total: 6500
      }
    ],
    subtotal: 23500,
    discount: 500,
    total: 23000,
    payment_method: 'Card',
    notes: 'Discount applied',
    created_at: '2026-09-09T14:15:00Z'
  }
]

export const generateReceiptNumber = (lastId) => {
  return `SAL-${1000 + lastId}`
}
