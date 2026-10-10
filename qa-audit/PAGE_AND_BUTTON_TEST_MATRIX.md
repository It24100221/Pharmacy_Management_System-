# Page and Button Test Matrix

Audit date: 2026-10-09  
Browser: Microsoft Edge via DevTools Protocol  
Viewports: 1440×900, 1366×768, 768×1024, 390×844, 320×640

## Coverage rules

- All 51 React route patterns, including aliases and wildcard behavior, were opened directly at all five viewports: 255 route/viewport runs.
- 291 visible page-control instances were inventoried on desktop. Repeated global navigation controls are counted on each page where they occur.
- 21 actual control actions were executed: five staff logins, one invalid login, and 15 safe UI controls. Five additional unauthorized direct-route checks passed.
- Mutation controls on the shared database are marked `BLOCKED`, not passed. Their invalid-input API behavior was tested separately.
- Strict page result: any unexpected HTTP 500 makes the route `FAIL`, even if its main content renders.

## Page matrix

| Page | Role | Desktop control inventory | Executed interaction/result | Page result | Bug/blocker |
|---|---|---|---|---|---|
| `/` | Public | Navigation links | Direct load and recovery-link target | PASS | |
| `/pharmacy-items` | Public | Search, category, 11 order buttons | Search empty-state and sign-in navigation pass | PASS | |
| `/login` | Public | Customer/staff/register links | Customer-login link pass | PASS | |
| `/customer-login` | Public | Username, password, sign in | Invalid login shows controlled error | PASS | valid customer password unavailable |
| `/staff-login` | Public | Username, password, sign in | Valid login passes for all five staff roles | PASS | |
| `/customer-register` | Public | 7 fields, create account | Required-field validation passes; server submission fails | PASS (render) | BUG-003 blocks valid registration |
| `/register` | Public | Same registration controls | Alias renders | PASS (render) | BUG-003 blocks valid registration |
| `*` (tested `/definitely-missing`) | Public | Home link | Home recovery link pass | PASS | |
| `/customer/dashboard` | Customer | Logout, navigation | Logout clears session and redirects | PASS | |
| `/customer-dashboard` | Customer | Logout, navigation | Alias/direct load | PASS | |
| `/customer/checkout` | Customer | Logout, create order | Empty create button correctly disabled | PASS | successful checkout BLOCKED on shared DB |
| `/upload-prescription` | Customer | Logout, order ID, file, doctor, notes, upload | Render/file controls inventoried | PASS | real upload BLOCKED on shared DB; file validation unit-tested |
| `/my-prescriptions` | Customer | Logout, record/file links when present | Empty/current state loads | PASS | lifecycle mutation BLOCKED |
| `/my-orders` | Customer | Logout, order links | List loads | PASS | |
| `/orders/:id` | Customer | Logout, order actions by state | Real owned order fixture loads | PASS | destructive/state transitions BLOCKED |
| `/staff/admin` | Admin | Logout, dashboard links | Login/route works, background API 500 | FAIL | BUG-001 |
| `/admin-dashboard` | Admin | Logout, dashboard links | Login redirect correct, background API 500 | FAIL | BUG-001 |
| `/staff/inventory` | Inventory | Logout, dashboard links | Login/route works | PASS | |
| `/inventory-dashboard` | Inventory | Logout, dashboard links | Login redirect correct | PASS | |
| `/staff/sales` | Sales | Logout, dashboard links | Login/route works | PASS | |
| `/sales-dashboard` | Sales | Logout, dashboard links | Login redirect correct | PASS | |
| `/staff/pharmacist` | Pharmacist | Logout, dashboard links | Login/route works, background API 500 | FAIL | BUG-001 |
| `/pharmacist-dashboard` | Pharmacist | Logout, dashboard links | Login redirect correct, background API 500 | FAIL | BUG-001 |
| `/staff/supplier` | Supplier | Logout, dashboard links | Login/route works | PASS | |
| `/supplier-dashboard` | Supplier | Logout, dashboard links | Login redirect correct | PASS | |
| `/medicines` | Admin/read roles | Global nav, notifications, search, 2 filters, row links | Search, stock filter, notifications pass | FAIL | BUG-001 background 500 |
| `/medicines/low-stock` | Admin/read roles | Global nav, row links | Data/empty state renders | FAIL | BUG-001 background 500 |
| `/medicines/expiry` | Admin/read roles | Global nav, 4 status tabs | Expired filter pass | FAIL | BUG-001 background 500 |
| `/medicines/:id/batches` | Admin/read roles | Batch form, adjustment form, history | Real medicine read succeeds | FAIL | BUG-001; writes BLOCKED |
| `/medicines/add` | Admin/inventory | 8 fields, cancel, save | Empty validation and cancel pass | FAIL | BUG-001; BUG-004; save BLOCKED |
| `/medicines/edit/:id` | Admin/inventory | 8 fields, cancel, update | Real record renders | FAIL | BUG-001; BUG-004; update BLOCKED |
| `/suppliers` | Admin/inventory/supplier | Search, row links, 8 delete buttons | List/search controls render | FAIL | BUG-001; delete BLOCKED |
| `/suppliers/add` | Admin/inventory | 5 fields, cancel, save | Empty validation pass | FAIL | BUG-001; save BLOCKED |
| `/suppliers/edit/:id` | Admin/inventory | 5 fields, cancel, update | Real supplier fixture loads | FAIL | BUG-001; update BLOCKED |
| `/purchases` | Admin/inventory | Supplier, date, notes, item search/add | Form renders | FAIL | BUG-001; purchase write BLOCKED |
| `/purchase-orders` | Admin/inventory | Supplier, medicine, quantity, cost, create, row links | List and empty state render | FAIL | BUG-001; create BLOCKED |
| `/purchase-orders/:id` | Admin/inventory/supplier | Status actions, details | Missing-record state only | FAIL | BUG-001; no live fixture |
| `/goods-receipts` | Admin/inventory | Confirmed-order selector, receipt fields when selected | Empty state renders | FAIL | BUG-001; no confirmed PO fixture |
| `/supplier-purchasing` | Admin/inventory | 8 reorder buttons, inquiry form, invoice form | Controls render | FAIL | BUG-001; success writes BLOCKED |
| `/supplier-inquiries/:id` | Allowed staff | Message/status controls when present | Missing-record state only | FAIL | BUG-001; no live fixture |
| `/supplier-invoices/:id` | Admin/inventory | Payment controls when present | Missing-record state only | FAIL | BUG-001; no live fixture |
| `/sales` | Admin/sales | Search, discount, payment, cart controls, complete | Empty complete button disabled | FAIL | BUG-001; successful sale BLOCKED |
| `/sales/receipt/:id` | Admin/sales | Print, new sale, dashboard | Real receipt loads in 4/5 runs | FAIL | BUG-001; one intermittent resource error |
| `/billing-orders` | Admin/sales | Expected refresh/order/payment controls | Page crashes before controls render | FAIL | BUG-001, BUG-002 |
| `/customers` | Admin/pharmacist/sales | Search, row links, 9 delete buttons | List renders | FAIL | BUG-001; delete BLOCKED |
| `/customers/:id` | Admin/pharmacist/sales | Back/edit/history links | Real fixture loads | FAIL | BUG-001 |
| `/customers/add` | Admin/pharmacist | 6 fields, cancel, save | Controls render | FAIL | BUG-001; save BLOCKED |
| `/customers/edit/:id` | Admin/pharmacist | 6 fields, cancel, update | Real fixture loads | FAIL | BUG-001; update BLOCKED |
| `/prescriptions/create` | Admin/pharmacist | Customer/date/instructions/item search/add/save | Form renders | FAIL | BUG-001; save BLOCKED |
| `/prescriptions/:id` | Admin/pharmacist/customer | Back and lifecycle actions by state | Real prescription fixture loads | FAIL | BUG-001; transitions BLOCKED |
| `/prescription-orders` | Admin/pharmacist | Refresh, review/detail actions when present | Refresh control renders; list request fails | FAIL | BUG-001 |

## Role authorization checks

| Authenticated role | Forbidden route attempted | Expected redirect | Actual | Result |
|---|---|---|---|---|
| Customer | `/medicines` | customer dashboard | customer dashboard | PASS |
| Sales | `/suppliers` | sales dashboard | sales dashboard | PASS |
| Inventory | `/sales` | inventory dashboard | inventory dashboard | PASS |
| Supplier | `/customers` | supplier dashboard | supplier dashboard | PASS |
| Pharmacist | `/purchases` | pharmacist dashboard | pharmacist dashboard | PASS |

## Responsive and accessibility results

- No horizontal document overflow was detected in 255 viewport runs.
- Mobile navigation drawer opened successfully at 390×844.
- All product images rendered with alt text or a non-image fallback.
- 41 label/control association failures were found across eight forms (BUG-008).
- Keyboard traversal, focus trapping, screen-reader announcement quality, and print-dialog behavior were not fully automated and remain `NOT TESTED`.

## Control coverage conclusion

The audit found 291 visible page-control instances but safely executed only 21 controls (7.2%). The remainder are mostly duplicate navigation controls or data-changing actions that could not be run on the shared database. They are not counted as passed. Invalid-input behavior for the corresponding APIs was exercised without writes in the API report.
