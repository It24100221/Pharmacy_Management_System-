import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import CustomerHome from './pages/CustomerHome.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { CustomerLogin, StaffLogin, CustomerRegister } from './pages/AuthPages.jsx'
import PharmacyItems from './pages/PharmacyItems.jsx'
import CustomerDashboard from './pages/CustomerDashboard.jsx'
import CustomerCheckout from './pages/CustomerCheckout.jsx'
import UploadPrescription from './pages/UploadPrescription.jsx'
import MyPrescriptions from './pages/MyPrescriptions.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import InventoryDashboard from './pages/InventoryDashboard.jsx'
import SalesDashboard from './pages/SalesDashboard.jsx'
import PharmacistDashboard from './pages/PharmacistDashboard.jsx'
import SupplierDashboard from './pages/SupplierDashboard.jsx'

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

const staffRoles = ['ADMIN', 'PHARMACIST', 'INVENTORY', 'SALES', 'SUPPLIER']

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<CustomerHome />} />
        <Route path="/pharmacy-items" element={<PharmacyItems />} />
      </Route>

      <Route path="/login" element={<CustomerLogin />} />
      <Route path="/customer-login" element={<CustomerLogin />} />
      <Route path="/staff-login" element={<StaffLogin />} />
      <Route path="/customer-register" element={<CustomerRegister />} />
      <Route path="/register" element={<CustomerRegister />} />

      <Route element={<ProtectedRoute roles={['CUSTOMER']} />}>
        <Route path="/customer/dashboard" element={<CustomerDashboard />} />
        <Route path="/customer-dashboard" element={<CustomerDashboard />} />
        <Route path="/customer/checkout" element={<CustomerCheckout />} />
        <Route path="/upload-prescription" element={<UploadPrescription />} />
        <Route path="/my-prescriptions" element={<MyPrescriptions />} />
      </Route>

      <Route element={<ProtectedRoute roles={staffRoles} />}>
        <Route path="/staff/admin" element={<AdminDashboard />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/staff/inventory" element={<InventoryDashboard />} />
        <Route path="/inventory-dashboard" element={<InventoryDashboard />} />
        <Route path="/staff/sales" element={<SalesDashboard />} />
        <Route path="/sales-dashboard" element={<SalesDashboard />} />
        <Route path="/staff/pharmacist" element={<PharmacistDashboard />} />
        <Route path="/pharmacist-dashboard" element={<PharmacistDashboard />} />
      </Route>

      <Route element={<ProtectedRoute roles={['SUPPLIER']} />}>
        <Route path="/staff/supplier" element={<SupplierDashboard />} />
        <Route path="/supplier-dashboard" element={<SupplierDashboard />} />
      </Route>

      <Route element={<ProtectedRoute roles={staffRoles} />}>
        <Route element={<AppLayout />}>

        {/* Inventory */}
        <Route path="/medicines" element={<MedicineListPage />} />
        <Route path="/medicines/add" element={<AddMedicinePage />} />
        <Route path="/medicines/edit/:id" element={<EditMedicinePage />} />
        <Route path="/medicines/low-stock" element={<LowStockPage />} />
        <Route path="/medicines/expiry" element={<ExpiryPage />} />

        {/* Sales */}
        <Route path="/sales" element={<POSPage />} />
        <Route path="/sales/receipt/:id" element={<ReceiptPage />} />

        {/* Suppliers */}
        <Route path="/suppliers" element={<SupplierListPage />} />
        <Route path="/suppliers/add" element={<AddSupplierPage />} />
        <Route path="/suppliers/edit/:id" element={<EditSupplierPage />} />

        {/* Purchases */}
        <Route path="/purchases" element={<CreatePurchasePage />} />

        {/* Customers */}
        <Route path="/customers" element={<CustomerListPage />} />
        <Route path="/customers/add" element={<AddCustomerPage />} />
        <Route path="/customers/edit/:id" element={<EditCustomerPage />} />
        <Route path="/customers/:id" element={<CustomerDetailsPage />} />

        {/* Prescriptions */}
        <Route path="/prescriptions/create" element={<CreatePrescriptionPage />} />
        <Route path="/prescriptions/:id" element={<PrescriptionDetailsPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
