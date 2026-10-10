import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import CustomerHome from './pages/CustomerHome.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import { CustomerLogin, StaffLogin, CustomerRegister, LoginChooser } from './pages/AuthPages.jsx'
import PharmacyItems from './pages/PharmacyItems.jsx'
import CustomerDashboard from './pages/CustomerDashboard.jsx'
import UploadPrescription from './pages/UploadPrescription.jsx'
import MyPrescriptions from './pages/MyPrescriptions.jsx'
import CheckoutPage from './pages/CheckoutPage.jsx'
import MyOrders from './pages/MyOrders.jsx'
import OrderDetails from './pages/OrderDetails.jsx'
import PrescriptionReviewQueue from './pages/PrescriptionReviewQueue.jsx'
import BillingOrderQueue from './pages/BillingOrderQueue.jsx'
import NotFound from './pages/NotFound.jsx'
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
import MedicineBatchesPage from './pages/Medicines/MedicineBatchesPage.jsx'

// Sales pages
import POSPage from './pages/Sales/POSPage.jsx'
import ReceiptPage from './pages/Sales/ReceiptPage.jsx'
import SalesHistoryPage from './pages/Sales/SalesHistoryPage.jsx'
import InvoiceHistoryPage from './pages/Sales/InvoiceHistoryPage.jsx'

// Supplier pages
import SupplierListPage from './pages/Suppliers/SupplierListPage.jsx'
import AddSupplierPage from './pages/Suppliers/AddSupplierPage.jsx'
import EditSupplierPage from './pages/Suppliers/EditSupplierPage.jsx'

// Purchase pages
import CreatePurchasePage from './pages/Purchases/CreatePurchasePage.jsx'
import PurchaseOrdersPage from './pages/Purchases/PurchaseOrdersPage.jsx'
import PurchaseOrderDetailsPage from './pages/Purchases/PurchaseOrderDetailsPage.jsx'
import GoodsReceiptsPage from './pages/Purchases/GoodsReceiptsPage.jsx'
import SupplierOperationsPage from './pages/Purchases/SupplierOperationsPage.jsx'
import SupplierInquiryDetailsPage from './pages/Purchases/SupplierInquiryDetailsPage.jsx'
import SupplierInvoiceDetailsPage from './pages/Purchases/SupplierInvoiceDetailsPage.jsx'

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
        <Route path="/" element={<CustomerHome />} />
        <Route path="/pharmacy-items" element={<PharmacyItems />} />
      </Route>

      <Route path="/login" element={<LoginChooser />} />
      <Route path="/customer-login" element={<CustomerLogin />} />
      <Route path="/staff-login" element={<StaffLogin />} />
      <Route path="/customer-register" element={<CustomerRegister />} />
      <Route path="/register" element={<CustomerRegister />} />

      <Route element={<ProtectedRoute roles={['CUSTOMER']} />}>
        <Route path="/customer/dashboard" element={<CustomerDashboard />} />
        <Route path="/customer-dashboard" element={<CustomerDashboard />} />
        <Route path="/customer/checkout" element={<CheckoutPage />} />
        <Route path="/upload-prescription" element={<UploadPrescription />} />
        <Route path="/my-prescriptions" element={<MyPrescriptions />} />
        <Route path="/my-orders" element={<MyOrders />} />
        <Route path="/orders/:id" element={<OrderDetails />} />
      </Route>

      <Route element={<ProtectedRoute roles={['ADMIN']} />}>
        <Route path="/staff/admin" element={<AdminDashboard />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
      </Route>
      <Route element={<ProtectedRoute roles={['ADMIN', 'INVENTORY']} />}>
        <Route path="/staff/inventory" element={<InventoryDashboard />} />
        <Route path="/inventory-dashboard" element={<InventoryDashboard />} />
      </Route>
      <Route element={<ProtectedRoute roles={['ADMIN', 'SALES']} />}>
        <Route path="/staff/sales" element={<SalesDashboard />} />
        <Route path="/sales-dashboard" element={<SalesDashboard />} />
      </Route>
      <Route element={<ProtectedRoute roles={['ADMIN', 'PHARMACIST']} />}>
        <Route path="/staff/pharmacist" element={<PharmacistDashboard />} />
        <Route path="/pharmacist-dashboard" element={<PharmacistDashboard />} />
      </Route>

      <Route element={<ProtectedRoute roles={['ADMIN', 'SUPPLIER']} />}>
        <Route path="/staff/supplier" element={<SupplierDashboard />} />
        <Route path="/supplier-dashboard" element={<SupplierDashboard />} />
      </Route>

      <Route element={<ProtectedRoute roles={['ADMIN', 'PHARMACIST', 'INVENTORY', 'SALES']} />}>
        <Route element={<AppLayout />}>

        {/* Inventory reads */}
        <Route path="/medicines" element={<MedicineListPage />} />
        <Route path="/medicines/low-stock" element={<LowStockPage />} />
        <Route path="/medicines/expiry" element={<ExpiryPage />} />
        <Route path="/medicines/:id/batches" element={<MedicineBatchesPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['ADMIN', 'INVENTORY']} />}>
        <Route element={<AppLayout />}>
        <Route path="/medicines/add" element={<AddMedicinePage />} />
        <Route path="/medicines/edit/:id" element={<EditMedicinePage />} />
        <Route path="/suppliers/add" element={<AddSupplierPage />} />
        <Route path="/suppliers/edit/:id" element={<EditSupplierPage />} />
        <Route path="/purchases" element={<CreatePurchasePage />} />
        <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="/purchase-orders/:id" element={<PurchaseOrderDetailsPage />} />
        <Route path="/goods-receipts" element={<GoodsReceiptsPage />} />
        <Route path="/supplier-purchasing" element={<SupplierOperationsPage />} />
        <Route path="/supplier-inquiries/:id" element={<SupplierInquiryDetailsPage />} />
        <Route path="/supplier-invoices/:id" element={<SupplierInvoiceDetailsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['ADMIN', 'SALES']} />}>
        <Route element={<AppLayout />}>
        <Route path="/sales" element={<POSPage />} />
        <Route path="/sales/receipt/:id" element={<ReceiptPage />} />
        <Route path="/sales-history" element={<SalesHistoryPage />} />
        <Route path="/invoice-history" element={<InvoiceHistoryPage />} />
        <Route path="/billing-orders" element={<BillingOrderQueue />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['ADMIN', 'INVENTORY', 'SUPPLIER']} />}>
        <Route element={<AppLayout />}>
        <Route path="/suppliers" element={<SupplierListPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['ADMIN', 'PHARMACIST', 'SALES']} />}>
        <Route element={<AppLayout />}>
        <Route path="/customers" element={<CustomerListPage />} />
        <Route path="/customers/:id" element={<CustomerDetailsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['ADMIN', 'PHARMACIST']} />}>
        <Route element={<AppLayout />}>
        <Route path="/customers/add" element={<AddCustomerPage />} />
        <Route path="/customers/edit/:id" element={<EditCustomerPage />} />
        <Route path="/prescriptions/create" element={<CreatePrescriptionPage />} />
        <Route path="/prescriptions/:id" element={<PrescriptionDetailsPage />} />
        <Route path="/prescription-orders" element={<PrescriptionReviewQueue />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
