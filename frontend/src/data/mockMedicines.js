// ============================================================================
// Mock Medicines Data
// Senevirathna Medical Pharmacy
// NOTE: Frontend demo data. Replace with API data later.
// ============================================================================

export const mockMedicines = [
  {
    id: 1,
    name: 'Amoxicillin 500mg Capsules',
    genericName: 'Amoxicillin',
    category: 'Antibiotics',
    batchNumber: 'AMX-2024-001',
    quantity: 150,
    unitPrice: 2500,
    expiryDate: '2026-12-31',
    minStockLevel: 20,
    stockStatus: 'in_stock',
    expiryStatus: 'valid'
  },
  {
    id: 2,
    name: 'Paracetamol 500mg Tablets',
    genericName: 'Paracetamol',
    category: 'Analgesics',
    batchNumber: 'PCM-2024-002',
    quantity: 200,
    unitPrice: 850,
    expiryDate: '2026-08-15',
    minStockLevel: 30,
    stockStatus: 'in_stock',
    expiryStatus: 'near_expiry'
  },
  {
    id: 3,
    name: 'Omeprazole 20mg Capsules',
    genericName: 'Omeprazole',
    category: 'Gastrointestinal',
    batchNumber: 'OME-2024-003',
    quantity: 85,
    unitPrice: 1200,
    expiryDate: '2026-06-30',
    minStockLevel: 15,
    stockStatus: 'in_stock',
    expiryStatus: 'valid'
  },
  {
    id: 4,
    name: 'Metformin 500mg Tablets',
    genericName: 'Metformin HCl',
    category: 'Diabetes',
    batchNumber: 'MET-2024-004',
    quantity: 120,
    unitPrice: 1800,
    expiryDate: '2026-09-30',
    minStockLevel: 25,
    stockStatus: 'in_stock',
    expiryStatus: 'valid'
  },
  {
    id: 5,
    name: 'Cetirizine 10mg Tablets',
    genericName: 'Cetirizine HCl',
    category: 'Antihistamines',
    batchNumber: 'CTZ-2024-005',
    quantity: 60,
    unitPrice: 650,
    expiryDate: '2026-04-20',
    minStockLevel: 10,
    stockStatus: 'in_stock',
    expiryStatus: 'near_expiry'
  },
  {
    id: 6,
    name: 'Azithromycin 250mg Tablets (6pcs)',
    genericName: 'Azithromycin',
    category: 'Antibiotics',
    batchNumber: 'AZI-2024-006',
    quantity: 5,
    unitPrice: 3200,
    expiryDate: '2026-11-15',
    minStockLevel: 10,
    stockStatus: 'low_stock',
    expiryStatus: 'valid'
  },
  {
    id: 7,
    name: 'Atorvastatin 20mg Tablets',
    genericName: 'Atorvastatin Calcium',
    category: 'Cardiovascular',
    batchNumber: 'ATOR-2024-007',
    quantity: 8,
    unitPrice: 2100,
    expiryDate: '2026-07-20',
    minStockLevel: 15,
    stockStatus: 'low_stock',
    expiryStatus: 'near_expiry'
  },
  {
    id: 8,
    name: 'Ibuprofen 400mg Tablets',
    genericName: 'Ibuprofen',
    category: 'Analgesics',
    batchNumber: 'IBU-2024-008',
    quantity: 45,
    unitPrice: 950,
    expiryDate: '2026-05-15',
    minStockLevel: 20,
    stockStatus: 'in_stock',
    expiryStatus: 'near_expiry'
  },
  {
    id: 9,
    name: 'Cough Syrup - Honey Lemon',
    genericName: 'Dextromethorphan',
    category: 'Respiratory',
    batchNumber: 'COUGHY-2023-009',
    quantity: 25,
    unitPrice: 750,
    expiryDate: '2025-01-10',
    minStockLevel: 10,
    stockStatus: 'in_stock',
    expiryStatus: 'expired'
  },
  {
    id: 10,
    name: 'Loratadine 10mg Tablets',
    genericName: 'Loratadine',
    category: 'Antihistamines',
    batchNumber: 'LRT-2024-010',
    quantity: 90,
    unitPrice: 890,
    expiryDate: '2026-10-01',
    minStockLevel: 15,
    stockStatus: 'in_stock',
    expiryStatus: 'valid'
  },
  {
    id: 11,
    name: 'Losartan 50mg Tablets',
    genericName: 'Losartan Potassium',
    category: 'Cardiovascular',
    batchNumber: 'LOS-2024-011',
    quantity: 75,
    unitPrice: 1450,
    expiryDate: '2026-03-25',
    minStockLevel: 20,
    stockStatus: 'in_stock',
    expiryStatus: 'near_expiry'
  },
  {
    id: 12,
    name: 'Salbutamol Inhaler (100mcg)',
    genericName: 'Salbutamol',
    category: 'Respiratory',
    batchNumber: 'SAL-2024-012',
    quantity: 30,
    unitPrice: 3500,
    expiryDate: '2026-08-01',
    minStockLevel: 5,
    stockStatus: 'in_stock',
    expiryStatus: 'valid'
  },
  {
    id: 13,
    name: 'Metformin 1000mg Tablets (60pcs)',
    genericName: 'Metformin HCl ER',
    category: 'Diabetes',
    batchNumber: 'MET1000-2024-013',
    quantity: 0,
    unitPrice: 2200,
    expiryDate: '2026-12-01',
    minStockLevel: 10,
    stockStatus: 'out_of_stock',
    expiryStatus: 'valid'
  },
  {
    id: 14,
    name: 'Vitamin C 1000mg Tablets',
    genericName: 'Ascorbic Acid',
    category: 'Supplements',
    batchNumber: 'VITC-2024-014',
    quantity: 180,
    unitPrice: 550,
    expiryDate: '2027-01-15',
    minStockLevel: 25,
    stockStatus: 'in_stock',
    expiryStatus: 'valid'
  }
]

export const categories = [
  'Antibiotics',
  'Analgesics',
  'Gastrointestinal',
  'Diabetes',
  'Antihistamines',
  'Cardiovascular',
  'Respiratory',
  'Supplements'
]

// Helper to get stock status badge props
export const getStockBadge = (status) => {
  switch (status) {
    case 'in_stock':
      return { label: 'IN STOCK', className: 'in-stock', icon: 'CheckCircle' }
    case 'low_stock':
      return { label: 'LOW STOCK', className: 'low-stock', icon: 'AlertTriangle' }
    case 'out_of_stock':
      return { label: 'OUT OF STOCK', className: 'out-of-stock', icon: 'AlertCircle' }
    default:
      return { label: 'UNKNOWN', className: 'neutral', icon: 'AlertCircle' }
  }
}

// Helper to get expiry status badge props
export const getExpiryBadge = (status) => {
  switch (status) {
    case 'valid':
      return { label: 'VALID', className: 'valid', icon: 'CheckCircle' }
    case 'near_expiry':
      return { label: 'NEAR EXPIRY', className: 'near-expiry', icon: 'AlertTriangle' }
    case 'expired':
      return { label: 'EXPIRED', className: 'expired', icon: 'AlertCircle' }
    default:
      return { label: 'UNKNOWN', className: 'neutral', icon: 'AlertCircle' }
  }
}

// Format currency
export const formatLKR = (value) => {
  return `LKR ${value.toLocaleString('en-LK')}`
}
