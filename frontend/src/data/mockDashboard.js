// ============================================================================
// Dashboard Mock Data
// Senevirathna Medical Pharmacy
// NOTE: These are frontend demo values. Replace with API data later.
// ============================================================================

// KPIs
export const dashboardStats = {
  totalMedicines: 112,
  lowStock: 8,
  nearExpiry: 5,
  todaysSales: 12,
  todaysRevenue: 98000,
  activeSuppliers: 12,
  customersServed: 9,
  prescriptionsCreated: 7,
  medicinesReceived: 145
}

// Low Stock Alerts
export const lowStockAlerts = [
  {
    id: 1,
    name: 'Amoxicillin 500mg',
    genericName: 'Amoxicillin',
    currentStock: 8,
    reorderLevel: 10,
    status: 'low_stock'
  },
  {
    id: 2,
    name: 'Cetirizine 10mg',
    genericName: 'Cetirizine HCl',
    currentStock: 5,
    reorderLevel: 12,
    status: 'low_stock'
  },
  {
    id: 3,
    name: 'Azithromycin 250mg',
    genericName: 'Azithromycin',
    currentStock: 3,
    reorderLevel: 8,
    status: 'low_stock'
  },
  {
    id: 4,
    name: 'Metformin 500mg',
    genericName: 'Metformin HCl',
    currentStock: 0,
    reorderLevel: 10,
    status: 'out_of_stock'
  }
]

// Expiry Alerts
export const expiryAlerts = [
  {
    id: 1,
    name: 'Paracetamol 500mg',
    expiryDate: '2026-09-20',
    daysRemaining: 11,
    status: 'near_expiry'
  },
  {
    id: 2,
    name: 'Omeprazole 20mg',
    expiryDate: '2026-09-15',
    daysRemaining: 6,
    status: 'near_expiry'
  },
  {
    id: 3,
    name: 'Cough Syrup - Honey Lemon',
    expiryDate: '2026-08-30',
    daysRemaining: -11,
    status: 'expired'
  }
]

// Recent Activity
export const recentActivity = [
  {
    id: 1,
    icon: 'Package',
    title: 'Stock received for Amoxicillin 500mg',
    category: 'Purchase',
    time: '2 hours ago'
  },
  {
    id: 2,
    icon: 'ClipboardPlus',
    title: 'Prescription created for Kamal Perera',
    category: 'Prescription',
    time: '3 hours ago'
  },
  {
    id: 3,
    icon: 'ShoppingCart',
    title: 'Sale completed – Receipt #SAL-1005',
    category: 'Sale',
    time: '5 hours ago'
  },
  {
    id: 4,
    icon: 'Pencil',
    title: 'Medicine details updated – Cetirizine 10mg',
    category: 'Inventory',
    time: 'Yesterday'
  },
  {
    id: 5,
    icon: 'User',
    title: 'New customer registered – Nimali Abeykoon',
    category: 'Customer',
    time: 'Yesterday'
  }
]

// Quick Actions
export const quickActions = [
  {
    label: 'New Sale',
    route: '/sales',
    icon: 'ShoppingCart',
    variant: 'primary'
  },
  {
    label: 'Add Medicine',
    route: '/medicines/add',
    icon: 'Pill',
    variant: 'secondary'
  },
  {
    label: 'Receive Stock',
    route: '/purchases',
    icon: 'Package',
    variant: 'secondary'
  },
  {
    label: 'Add Customer',
    route: '/customers/add',
    icon: 'User',
    variant: 'secondary'
  },
  {
    label: 'Create Prescription',
    route: '/prescriptions/create',
    icon: 'ClipboardPlus',
    variant: 'secondary'
  }
]

// Module Cards
export const moduleCards = [
  {
    title: 'Medicine & Inventory',
    description: 'Manage medicine details, monitor current stock and track expiry status.',
    route: '/medicines',
    actionLabel: 'Open Inventory',
    icon: 'Pill',
    stats: {
      medicines: 112,
      lowStock: 8
    },
    statLabels: {
      medicines: 'Medicines',
      lowStock: 'Low Stock'
    }
  },
  {
    title: 'Sales & Billing',
    description: 'Process medicine sales, calculate bills and prepare customer receipts.',
    route: '/sales',
    actionLabel: 'New Sale',
    icon: 'ShoppingCart',
    stats: {
      revenue: 98000
    },
    statLabels: {
      revenue: "Today's Sales"
    }
  },
  {
    title: 'Supplier & Purchase',
    description: 'Maintain suppliers and record received medicine stock.',
    route: '/suppliers',
    actionLabel: 'Manage Suppliers',
    icon: 'Building2',
    stats: {
      suppliers: 12
    },
    statLabels: {
      suppliers: 'Active Suppliers'
    },
    secondaryAction: {
      label: 'Receive Stock',
      route: '/purchases'
    }
  },
  {
    title: 'Prescription & Customer',
    description: 'Manage customers, record prescriptions and verify medicine availability.',
    route: '/prescriptions/create',
    actionLabel: 'Create Prescription',
    icon: 'ClipboardPlus',
    stats: {
      prescriptions: 4
    },
    statLabels: {
      prescriptions: 'Pending Prescriptions'
    }
  }
]
