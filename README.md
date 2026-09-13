# Pharmacy Management System

**Senevirathna Medical Pharmacy**
**Project ID: ISE_WE_0101_19**

A complete, integrated web-based Pharmacy Management System built with React (frontend) and Node.js/Express (backend) with MySQL database.

## 📋 Project Overview

This system manages all aspects of pharmacy operations including:
- **Medicine & Inventory Management** - Track medicines, stock levels, and expiry dates
- **Sales & Billing Management** - Point of Sale (POS) with receipt generation
- **Supplier & Purchase Management** - Record purchases and automatically update stock
- **Prescription & Customer Management** - Create prescriptions and check medicine availability

## 🚀 Technology Stack

### Frontend
- React 18
- JavaScript
- Vite (build tool)
- React Router (navigation)
- Axios (API client)
- Plain CSS (styling)

### Backend
- Node.js
- Express.js
- JavaScript
- mysql2/promise (MySQL connectivity)
- dotenv (environment configuration)
- CORS

### Database
- MySQL with InnoDB engine

## 📁 Project Structure

```
pharmacy-management-system/
├── README.md
├── TODO.md
├── .gitignore
│
├── docs/
│   ├── requirements/
│   ├── diagrams/
│   │   ├── er-diagram/
│   │   ├── architecture/
│   │   └── workflows/
│   ├── api/
│   └── testing/
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── .env.example
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── assets/
│       ├── components/
│       │   ├── common/
│       │   │   ├── Button.jsx
│       │   │   ├── Input.jsx
│       │   │   ├── Modal.jsx
│       │   │   ├── Loading.jsx
│       │   │   ├── ErrorMessage.jsx
│       │   │   ├── EmptyState.jsx
│       │   │   └── ConfirmDialog.jsx
│       │   └── layout/
│       │       ├── Sidebar.jsx
│       │       ├── Header.jsx
│       │       └── AppLayout.jsx
│       ├── pages/
│       │   ├── Dashboard/
│       │   ├── Medicines/
│       │   ├── Sales/
│       │   ├── Suppliers/
│       │   ├── Purchases/
│       │   ├── Customers/
│       │   └── Prescriptions/
│       ├── services/
│       │   ├── api.js
│       │   ├── medicineService.js
│       │   ├── salesService.js
│       │   ├── supplierService.js
│       │   ├── purchaseService.js
│       │   ├── customerService.js
│       │   └── prescriptionService.js
│       ├── utils/
│       │   ├── currency.js
│       │   ├── dates.js
│       │   └── validation.js
│       └── styles/
│           └── index.css
│
├── backend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── server.js
│       ├── app.js
│       ├── config/
│       │   └── database.js
│       ├── routes/
│       │   ├── medicineRoutes.js
│       │   ├── salesRoutes.js
│       │   ├── supplierRoutes.js
│       │   ├── purchaseRoutes.js
│       │   ├── customerRoutes.js
│       │   └── prescriptionRoutes.js
│       ├── controllers/
│       │   ├── medicineController.js
│       │   ├── salesController.js
│       │   ├── supplierController.js
│       │   ├── purchaseController.js
│       │   ├── customerController.js
│       │   └── prescriptionController.js
│       ├── services/
│       ├── repositories/
│       │   ├── medicineRepository.js
│       │   ├── saleRepository.js
│       │   ├── supplierRepository.js
│       │   ├── purchaseRepository.js
│       │   ├── customerRepository.js
│       │   └── prescriptionRepository.js
│       ├── middleware/
│       │   ├── errorHandler.js
│       │   └── notFound.js
│       ├── validators/
│       │   ├── medicineValidator.js
│       │   ├── salesValidator.js
│       │   ├── supplierValidator.js
│       │   ├── purchaseValidator.js
│       │   ├── customerValidator.js
│       │   └── prescriptionValidator.js
│       └── utils/
│           ├── ApiError.js
│           └── asyncHandler.js
│
└── database/
    ├── schema.sql
    ├── seed.sql
    └── migrations/
```

## 🛠️ Setup Instructions

### Prerequisites
- Node.js (v16 or later)
- MySQL (v8.0 or later)
- npm or yarn

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd pharmacy-management-system
```

### 2. Database Setup

```bash
# Create MySQL database
mysql -u root -p

# In MySQL:
CREATE DATABASE pharmacy_management;
EXIT;

# Import schema
mysql -u root -p pharmacy_management < database/schema.sql

# Import seed data
mysql -u root -p pharmacy_management < database/seed.sql
```

### 3. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your database credentials
# PORT=5000
# DB_HOST=localhost
# DB_PORT=3306
# DB_USER=root
# DB_PASSWORD=your_password
# DB_NAME=pharmacy_management

# Start the server
npm start

# Or for development with auto-reload
npm run dev
```

The backend will start on `http://localhost:5000`

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# The .env should contain:
# VITE_API_BASE_URL=http://localhost:5000/api

# Start the development server
npm run dev

# Or build for production
npm run build
```

The frontend will start on `http://localhost:3000`

### 5. Access the Application

Open your browser and navigate to:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`
- Health Check: `http://localhost:5000/api/health`

## 🔗 API Endpoints

### Health Check
- `GET /api/health` - API health status

### Medicines
- `GET /api/medicines` - List all medicines (with search, filters)
- `GET /api/medicines/:id` - Get medicine by ID
- `POST /api/medicines` - Create new medicine
- `PUT /api/medicines/:id` - Update medicine
- `GET /api/medicines/low-stock` - Get low stock medicines
- `GET /api/medicines/expiry-status` - Get medicines by expiry status

### Sales
- `GET /api/sales` - List all sales
- `GET /api/sales/:id` - Get sale by ID
- `GET /api/sales/:id/receipt` - Get receipt for sale
- `GET /api/sales/today-summary` - Today's sales summary
- `POST /api/sales` - Create a sale (reduces stock)

### Suppliers
- `GET /api/suppliers` - List all suppliers
- `GET /api/suppliers/:id` - Get supplier by ID
- `POST /api/suppliers` - Create new supplier
- `PUT /api/suppliers/:id` - Update supplier

### Purchases
- `GET /api/purchases` - List all purchases
- `GET /api/purchases/:id` - Get purchase by ID
- `GET /api/purchases/recent` - Get recent purchases
- `POST /api/purchases` - Create purchase (increases stock)

### Customers
- `GET /api/customers` - List all customers
- `GET /api/customers/:id` - Get customer by ID
- `POST /api/customers` - Create new customer
- `PUT /api/customers/:id` - Update customer

### Prescriptions
- `GET /api/prescriptions` - List all prescriptions
- `GET /api/prescriptions/:id` - Get prescription by ID
- `GET /api/prescriptions/:id/availability` - Check medicine availability
- `POST /api/prescriptions` - Create prescription
- `POST /api/prescriptions/:id/send-to-billing` - Prepare for billing

## 📊 Database Schema

The database includes the following tables:

- **medicines** - Medicine inventory details
- **suppliers** - Supplier information
- **purchases** - Purchase headers
- **purchase_items** - Purchase line items
- **customers** - Customer information
- **prescriptions** - Prescription headers
- **prescription_items** - Prescription line items
- **sales** - Sale headers
- **sale_items** - Sale line items

## 🔄 Business Flows

### Flow 1: Supplier → Purchase → Inventory
1. Add/Edit suppliers
2. Create purchase and select medicines
3. Stock automatically increases when purchase is recorded

### Flow 2: Inventory → Sales & Billing
1. Search medicines on POS
2. Add to cart with quantities
3. Complete sale
4. Stock automatically decreases

### Flow 3: Customer → Prescription → Billing
1. Add customers
2. Create prescription with prescribed medicines
3. Check medicine availability
4. Send to billing (does NOT reduce stock)
5. Complete sale in POS (reduces stock)

## ✅ Sprint 1 Features

### Epic 1 - Medicine & Inventory Management
- [x] Add new medicine
- [x] Update medicine details
- [x] Search and view medicines
- [x] View current stock quantity
- [x] Identify low-stock medicines
- [x] Identify expired/near-expiry medicines

### Epic 2 - Sales & Billing Management
- [x] Search and select medicines for sale
- [x] Enter required quantity
- [x] Automatically calculate total bill
- [x] Generate customer receipt
- [x] Record completed sales
- [x] Reduce medicine stock after successful sale

### Epic 3 - Supplier & Purchase Management
- [x] Add supplier details
- [x] Update supplier details
- [x] Search/view supplier information
- [x] Record medicine purchases
- [x] Store purchase date, quantity and cost
- [x] Increase medicine stock when medicines are received

### Epic 4 - Prescription & Customer Management
- [x] Add customer details
- [x] Search/view customer details
- [x] Create prescription for customer
- [x] Store prescription details and prescribed medicines
- [x] Check medicine availability
- [x] Send prescribed medicines to Sales & Billing

## 🧪 Testing

### Manual Testing Checklist

1. **Medicine Management**
   - [ ] Add a new medicine
   - [ ] Search for medicines
   - [ ] Edit medicine details
   - [ ] View low stock medicines
   - [ ] View expiry status

2. **Supplier & Purchase**
   - [ ] Add a new supplier
   - [ ] Create a purchase
   - [ ] Verify stock increases

3. **Customer & Prescription**
   - [ ] Add a new customer
   - [ ] Create a prescription
   - [ ] Check availability
   - [ ] Send to billing

4. **Sales**
   - [ ] Search and add medicines to cart
   - [ ] Complete a sale
   - [ ] Verify stock decreases
   - [ ] View receipt

### Integration Test (End-to-End)
1. Start with medicine stock = 20
2. Receive purchase for 100 units → Stock = 120
3. Create prescription for 10 units
4. Check availability → Available
5. Send to billing
6. Complete sale
7. Stock = 110

## 🔒 Security & Validation

- All inputs are validated on both frontend and backend
- MySQL transactions ensure data integrity
- Stock levels are checked before sales
- Insufficient stock prevents sale completion
- Proper error messages are displayed

## 📝 Environment Variables

### Backend (.env)
```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=pharmacy_management
NODE_ENV=development
```

### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

## 📄 License

This project is for educational purposes as part of the Pharmacy Management System project (ISE_WE_0101_19).
