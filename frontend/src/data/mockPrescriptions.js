// Mock Prescriptions Data - Senevirathna Medical Pharmacy
export const mockPrescriptions = [
  {
    id: 1,
    customer_id: 1,
    customer_name: 'Kamal Perera',
    prescription_date: '2026-09-05',
    instructions: 'Take after meals. Complete the full course.',
    status: 'active',
    items: [
      {
        id: 1,
        medicine_id: 1,
        medicine_name: 'Amoxicillin 500mg Capsules',
        generic_name: 'Amoxicillin',
        batch_number: 'AMX-2024-001',
        quantity: 14,
        unit_price: 2500,
        instructions: '1 capsule 3 times daily'
      },
      {
        id: 2,
        medicine_id: 8,
        medicine_name: 'Ibuprofen 400mg Tablets',
        generic_name: 'Ibuprofen',
        batch_number: 'IBU-2024-008',
        quantity: 10,
        unit_price: 950,
        instructions: '1 tablet when needed for pain'
      }
    ],
    created_at: '2026-09-05T09:30:00Z'
  },
  {
    id: 2,
    customer_id: 2,
    customer_name: 'Nimali Abeykoon',
    prescription_date: '2026-09-08',
    instructions: 'Continue medication as prescribed.',
    status: 'active',
    items: [
      {
        id: 3,
        medicine_id: 4,
        medicine_name: 'Metformin 500mg Tablets',
        generic_name: 'Metformin HCl',
        batch_number: 'MET-2024-004',
        quantity: 30,
        unit_price: 1800,
        instructions: '1 tablet twice daily with food'
      }
    ],
    created_at: '2026-09-08T14:00:00Z'
  }
]

export const getStockAvailability = (requestedQty, currentStock) => {
  if (currentStock === 0) return 'out_of_stock'
  if (requestedQty > currentStock) return 'insufficient'
  return 'available'
}
