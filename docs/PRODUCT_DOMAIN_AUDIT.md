# Product Domain Audit

Phase: Business Foundation B1

Audit date: 2026-10-03

## Finding

Before B1, `medicines.id` was the only operational item identity. It correctly connected inventory, purchases, prescriptions, and sales, but it was an internal numeric key rather than a permanent customer-facing product code. The public `/api/products` endpoint was only an unpaginated projection of `medicines`, and the frontend invented customer category labels from medicine therapeutic-category strings.

The undeployed historical `products` design in `database/schema.sql` contained independent `name`, `price`, `quantity`, and `image` columns. Deploying it unchanged would create competing name, price, and stock sources beside `medicines` and break the existing operational identity chain.

## Module inventory

| Module | Current internal ID | Current display ID before B1 | Name source | Price source | Stock source | Category source | Image source | Expiry source | Prescription-required source | Dependencies |
|---|---|---|---|---|---|---|---|---|---|---|
| SQL `medicines` | `medicines.id` | None; name/batch shown | `medicines.name` | `medicines.unit_price` | `medicines.quantity` | `medicines.category` therapeutic text | None | `medicines.expiry_date` | None | Referenced by all three operational line-item tables |
| Inventory API/repository | `medicines.id` | Numeric ID was not consistently displayed | `medicines.name` | `medicines.unit_price` | `medicines.quantity`; threshold from `min_stock_level` | `medicines.category` | None | `medicines.expiry_date` | None | Medicine CRUD, low-stock and expiry queries |
| Medicine frontend/model | `medicine.id` | Medicine name/batch | API `name` | API `unit_price` normalized to `unitPrice` | API `quantity` | API therapeutic category | None | API expiry date/status | None | `normalizeMedicine`, list/add/edit/low-stock/expiry pages |
| `purchase_items` and purchase receiving | `purchase_items.medicine_id` | Medicine name/batch in details and selection | Joined `medicines.name` | `purchase_items.unit_cost` is historical supplier cost, not catalogue selling price | Receiving updates `medicines.quantity` | Medicine data | None | Medicine data | None | FK to the unchanged medicine PK; supplier and purchase header |
| `prescription_items` and pages | `prescription_items.medicine_id` | Medicine name/batch | Joined `medicines.name` | Current `medicines.unit_price` for availability/billing preparation | Current `medicines.quantity` | Medicine data | None | `medicines.expiry_date` | No explicit flag | FK to medicine; prescription header/customer |
| `sale_items`, POS, receipt | `sale_items.medicine_id` | Medicine name/batch | Joined `medicines.name` | Sale creation reloads authoritative `medicines.unit_price`; `sale_items.unit_price` is the immutable transaction snapshot | Sale reduces `medicines.quantity` | Medicine data | None | Sale blocks expired medicines using `medicines.expiry_date` | None | FK to medicine; sale header/customer |
| Supplier pages | No independent product identity | Supplier identity only | N/A | N/A | N/A | N/A | N/A | N/A | N/A | Product identity appears only through purchase items |
| Public product API before B1 | Aliased `medicines.id AS product_id` | No permanent code | `medicines.name` | `medicines.unit_price` | `medicines.quantity` | `medicines.category` | Always null | Not returned | Not returned | Public route; no detail/search/filter/pagination contract |
| Customer Pharmacy Items before B1 | Numeric `product_id` mapped to local `id` | None | API product name | API price | API quantity | Frontend mapping converted therapeutic strings to invented catalogue labels | API null / icon fallback | Not considered | Not considered | Local-only cart context and discontinued checkout surface |
| Historical undeployed `categories` | `category_id` | Category name | `category_name` | N/A | N/A | Self | N/A | N/A | N/A | Never deployed |
| Historical undeployed `products` | `product_id` | None | Independent `products.name` | Independent `products.price` | Independent `products.quantity` | FK to old categories | Short `NVARCHAR(500)` string | None | None | Never deployed; conflicts with medicine authority |

## Duplication and integrity risks

1. Deploying the old product table would allow medicine and product names, prices, and quantities to drift independently.
2. Treating a frontend array index or `medicines.id` label as a business code would expose an implementation key without an explicit permanent-ID contract.
3. Copying medicine stock to catalogue rows would make purchase/sale updates invisible unless every write path synchronized both counters.
4. Copying selling price would undermine the existing server-side sale-price recalculation.
5. Replacing or renumbering medicine rows would break 20 existing historical line items and their foreign keys.
6. Reusing `medicines.category` as the customer catalogue relation would mix therapeutic classifications such as `Antibiotics` with broad merchandise classes such as `Baby Items`.
7. A client-generated product code would be mutable, collision-prone, and race-prone.
8. Reusing arbitrary product image URLs would create an unvalidated external-content and path-traversal surface.

## B1 resolution

- `products` becomes the canonical identity/catalogue metadata table.
- `products.medicine_id` is a nullable, unique, stable link to the existing medicine row.
- Medicine-backed product values are resolved live from `medicines`; no second price or stock counter is created.
- Standalone future merchandise uses explicitly named `standalone_*` fields and cannot also be medicine-backed, enforced by a CHECK constraint.
- Broad catalogue category comes from `products.category_id`; the therapeutic medicine category remains medicine-specific metadata.
- Every existing medicine is mapped once without changing any medicine or transaction key.
- Product codes are database-computed from the immutable identity PK and cannot be supplied or changed by a client.
