# Authorization Matrix

Phase: Business Foundation B1

Date: 2026-10-03

## Role mapping

The matrix uses the role values already stored in SQL Server. Business-language names map as follows; no role values were renamed:

| Business name | Stored role |
|---|---|
| Customer | `CUSTOMER` |
| Prescription staff | `PHARMACIST` |
| Inventory staff | `INVENTORY` |
| Sales staff | `SALES` |
| Supplier | `SUPPLIER` |
| Administrator | `ADMIN` |

`ADMIN` is retained because an implemented admin dashboard and cross-operational access already exist. Authentication and authorization never depend on an email address.

## Public surface

| Surface | Access |
|---|---|
| Frontend `/`, `/pharmacy-items`, `/login`, `/customer-login`, `/staff-login`, `/customer-register`, `/register` | Public |
| `GET /api/health`, `GET /api/products`, `GET /api/products/:productCode` | Public read |
| `POST /api/customers/register` | Public customer registration |
| Customer/staff login APIs | Public credential exchange |

All other API routes in this document require a valid JWT and a current SQL user.

## Role summary

| Role | Dashboard | Read permissions | Write permissions | Ownership restrictions |
|---|---|---|---|---|
| `CUSTOMER` | `/customer-dashboard` | Own profile; own structured prescriptions; own upload history | Update own profile; upload a prescription for self | Customer ID is derived from the authenticated user. No arbitrary customer ID controls access. No list-all, other-customer CRUD, or other-customer prescription access. |
| `PHARMACIST` | `/pharmacist-dashboard` | Medicines, customers, structured prescriptions, customer upload history | Customer create/update/delete; structured prescription create; prepare prescription for billing | Staff workflow access; no sales, supplier, or purchase access. |
| `INVENTORY` | `/inventory-dashboard` | Medicines, suppliers, purchases | Medicine create/update; supplier create/update/delete; purchase create | No customer, prescription, or sales access. |
| `SALES` | `/sales-dashboard` | Medicines, customers, sales and receipts | Sale create | No customer mutation and no prescription, supplier, or purchase access. |
| `SUPPLIER` | `/supplier-dashboard` | Suppliers and purchases through the API; current frontend provides the read-only supplier directory | None | No medicine, customer, prescription, or sales access. No supplier or purchase mutation. |
| `ADMIN` | `/admin-dashboard` | All implemented operational domains | All implemented staff writes | No customer-self identity; customer/prescription access is administrative staff access. |

## Frontend routes

| Frontend route(s) | Allowed roles | Backend dependency / alignment |
|---|---|---|
| `/customer/dashboard`, `/customer-dashboard` | CUSTOMER | Authenticated customer identity; no bulk operational startup data |
| `/upload-prescription` | CUSTOMER | `POST /api/prescriptions/upload`, CUSTOMER only and token-derived customer ID |
| `/my-prescriptions` | CUSTOMER | `GET /api/prescriptions/mine`, CUSTOMER only and token-derived customer ID |
| `/admin-dashboard`, `/staff/admin` | ADMIN | Admin-scoped operational reads |
| `/pharmacist-dashboard`, `/staff/pharmacist` | ADMIN, PHARMACIST | Medicine/customer/prescription APIs |
| `/inventory-dashboard`, `/staff/inventory` | ADMIN, INVENTORY | Medicine/supplier APIs |
| `/sales-dashboard`, `/staff/sales` | ADMIN, SALES | Medicine/customer/sales APIs |
| `/supplier-dashboard`, `/staff/supplier` | ADMIN, SUPPLIER | Supplier read API |
| `/medicines`, `/medicines/low-stock`, `/medicines/expiry` | ADMIN, PHARMACIST, INVENTORY, SALES | Medicine GET routes allow the same roles |
| `/medicines/add`, `/medicines/edit/:id` | ADMIN, INVENTORY | Medicine POST/PUT routes allow the same roles |
| `/suppliers` | ADMIN, INVENTORY, SUPPLIER | Supplier GET routes allow the same roles |
| `/suppliers/add`, `/suppliers/edit/:id` | ADMIN, INVENTORY | Supplier write routes allow the same roles |
| `/purchases` | ADMIN, INVENTORY | The current page creates purchases; backend POST permits only these roles |
| `/sales`, `/sales/receipt/:id` | ADMIN, SALES | All sales routes permit only these roles |
| `/customers`, `/customers/:id` | ADMIN, PHARMACIST, SALES | Customer GET routes permit the same roles |
| `/customers/add`, `/customers/edit/:id` | ADMIN, PHARMACIST | Customer write routes permit the same roles |
| `/prescriptions/create`, `/prescriptions/:id` | ADMIN, PHARMACIST | Structured prescription work routes permit the same roles |

The discontinued `/customer/checkout` behavior redirects to the customer dashboard because an authenticated customer order backend is not implemented in this phase.

## Backend routes

### Customer profiles

| Method and route | Roles | Access |
|---|---|---|
| `GET /api/customers/me` | CUSTOMER | Read the profile linked to the authenticated user |
| `PUT /api/customers/me` | CUSTOMER | Update the profile linked to the authenticated user |
| `GET /api/customers` | ADMIN, PHARMACIST, SALES | List/search customer records |
| `GET /api/customers/:id` | ADMIN, PHARMACIST, SALES | Read a customer record |
| `POST /api/customers` | ADMIN, PHARMACIST | Create a customer record |
| `PUT /api/customers/:id` | ADMIN, PHARMACIST | Update a customer record |
| `DELETE /api/customers/:id` | ADMIN, PHARMACIST | Delete a customer record |

Customers cannot enter any arbitrary-ID CRUD route, including their own numeric ID; self-service is exclusively through `/me`.

### Prescriptions and uploads

| Method and route | Roles | Access |
|---|---|---|
| `GET /api/prescriptions` | CUSTOMER, ADMIN, PHARMACIST | Customer query is forcibly filtered to the authenticated customer; staff can list structured records |
| `POST /api/prescriptions/upload` | CUSTOMER | Creates an upload for the token-derived customer ID |
| `GET /api/prescriptions/mine` | CUSTOMER | Returns upload history for the token-derived customer ID |
| `GET /api/prescriptions/customer/:id` | CUSTOMER, ADMIN, PHARMACIST | Customer receives 403 unless `:id` equals the authenticated customer ID |
| `GET /api/prescription-uploads/:id/file` | CUSTOMER, ADMIN, PHARMACIST | Private file response; customer receives 403 unless the upload belongs to their authenticated customer ID |
| `GET /api/prescriptions/recent` | ADMIN, PHARMACIST | Staff workflow read |
| `GET /api/prescriptions/:id` | CUSTOMER, ADMIN, PHARMACIST | Customer receives 403 unless the record belongs to the authenticated customer |
| `GET /api/prescriptions/:id/availability` | CUSTOMER, ADMIN, PHARMACIST | Same record ownership check before availability data is returned |
| `POST /api/prescriptions` | ADMIN, PHARMACIST | Create a structured prescription for staff workflow |
| `POST /api/prescriptions/:id/send-to-billing` | ADMIN, PHARMACIST | Existing staff handoff; no approval workflow added |

`INVENTORY`, `SALES`, and `SUPPLIER` have no prescription record or private upload access.

### Medicines

| Method | Roles |
|---|---|
| GET list, low stock, expiry status, or record | ADMIN, PHARMACIST, INVENTORY, SALES |
| POST or PUT | ADMIN, INVENTORY |

### Suppliers

| Method | Roles |
|---|---|
| GET list or record | ADMIN, INVENTORY, SUPPLIER |
| POST, PUT, or DELETE | ADMIN, INVENTORY |

### Purchases

| Method | Roles |
|---|---|
| GET list, recent, or record | ADMIN, INVENTORY, SUPPLIER |
| POST | ADMIN, INVENTORY |

### Sales

All sale list, summary, record, receipt, and create routes are restricted to `ADMIN` and `SALES`.

### Product catalogue

`GET /api/products` and `GET /api/products/:productCode` are public, customer-safe reads. No product create, update, delete, image-upload, cart, or order API is deployed in B1; requests to mutate `/api/products` return 404 regardless of authentication.

## Enforcement principles

- The backend is authoritative. Frontend route hiding is usability, not the security boundary.
- JWTs identify a user; current role and customer ownership are loaded from SQL Server on every protected request.
- 401 means authentication is absent/invalid. 403 means a valid identity lacks permission.
- Customer ownership never trusts a frontend-supplied `customer_id`.
- Frontend data scopes and route allow-lists are no broader than the backend endpoints used by each page.
