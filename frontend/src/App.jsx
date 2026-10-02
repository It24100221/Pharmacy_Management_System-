import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import Dashboard from './pages/Dashboard/Dashboard.jsx'
import ProtectedRoute from './components/common/ProtectedRoute.jsx'
import LoginPage from './pages/Auth/LoginPage.jsx'
import RegisterPage from './pages/Auth/RegisterPage.jsx'
import RoleDashboard from './pages/Auth/RoleDashboard.jsx'
import UnauthorizedPage from './pages/Auth/UnauthorizedPage.jsx'
import PublicItemsPage from './pages/Auth/PublicItemsPage.jsx'

// Medicine pages
import MedicineListPage from './pages/Medicines/MedicineListPage.jsx'
import AddMedicinePage from './pages/Medicines/AddMedicinePage.jsx'
import EditMedicinePage from './pages/Medicines/EditMedicinePage.jsx'
import LowStockPage from './pages/Medicines/LowStockPage.jsx'
import ExpiryPage from './pages/Medicines/ExpiryPage.jsx'

// Sales pages
import POSPage from './pages/Sales/POSPage.jsx'
import ReceiptPage from './pages/Sales/ReceiptPage.jsx'

// Supplier pages
import SupplierListPage from './pages/Suppliers/SupplierListPage.jsx'
import AddSupplierPage from './pages/Suppliers/AddSupplierPage.jsx'
import EditSupplierPage from './pages/Suppliers/EditSupplierPage.jsx'

// Purchase pages
import CreatePurchasePage from './pages/Purchases/CreatePurchasePage.jsx'

// Customer pages
import CustomerListPage from './pages/Customers/CustomerListPage.jsx'
import AddCustomerPage from './pages/Customers/AddCustomerPage.jsx'
import CustomerDetailsPage from './pages/Customers/CustomerDetailsPage.jsx'
import EditCustomerPage from './pages/Customers/EditCustomerPage.jsx'

// Prescription pages
import CreatePrescriptionPage from './pages/Prescriptions/CreatePrescriptionPage.jsx'
import PrescriptionDetailsPage from './pages/Prescriptions/PrescriptionDetailsPage.jsx'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pharmacy-items" element={<PublicItemsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        <Route element={<ProtectedRoute roles={['CUSTOMER']} />}>
          <Route path="/customer-dashboard" element={<RoleDashboard />} />
        </Route>
        <Route element={<ProtectedRoute roles={['PRESCRIPTION_STAFF']} />}>
          <Route path="/prescription-dashboard" element={<RoleDashboard />} />
          <Route path="/customers" element={<CustomerListPage />} />
          <Route path="/customers/add" element={<AddCustomerPage />} />
          <Route path="/customers/edit/:id" element={<EditCustomerPage />} />
          <Route path="/customers/:id" element={<CustomerDetailsPage />} />
          <Route path="/prescriptions/create" element={<CreatePrescriptionPage />} />
          <Route path="/prescriptions/:id" element={<PrescriptionDetailsPage />} />
        </Route>
        <Route element={<ProtectedRoute roles={['SUPPLIER']} />}>
          <Route path="/supplier-dashboard" element={<RoleDashboard />} />
        </Route>
        <Route element={<ProtectedRoute roles={['SUPPLIER', 'INVENTORY_STAFF']} />}>
          <Route path="/suppliers" element={<SupplierListPage />} />
          <Route path="/purchases" element={<CreatePurchasePage />} />
        </Route>
        <Route element={<ProtectedRoute roles={['INVENTORY_STAFF']} />}>
          <Route path="/inventory-dashboard" element={<RoleDashboard />} />
          <Route path="/medicines" element={<MedicineListPage />} />
          <Route path="/medicines/add" element={<AddMedicinePage />} />
          <Route path="/medicines/edit/:id" element={<EditMedicinePage />} />
          <Route path="/medicines/low-stock" element={<LowStockPage />} />
          <Route path="/medicines/expiry" element={<ExpiryPage />} />
          <Route path="/suppliers/add" element={<AddSupplierPage />} />
          <Route path="/suppliers/edit/:id" element={<EditSupplierPage />} />
        </Route>
        <Route element={<ProtectedRoute roles={['SALES_STAFF']} />}>
          <Route path="/sales-dashboard" element={<RoleDashboard />} />
          <Route path="/sales" element={<POSPage />} />
          <Route path="/sales/receipt/:id" element={<ReceiptPage />} />
        </Route>

        <Route path="*" element={<div className="content-container auth-dashboard"><h1>Page not found</h1></div>} />
      </Route>
    </Routes>
  )
}

export default App
