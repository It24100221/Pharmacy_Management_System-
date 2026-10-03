# Canonical Product Model

Phase: Business Foundation B1

## Identity

`dbo.products` is the canonical product identity table.

| Field | Role |
|---|---|
| `product_id` | Internal SQL Server `IDENTITY` primary key. It is stable and never replaces `medicines.id`. |
| `product_code` | Persisted computed business ID: `P` plus the zero-padded 10-digit `product_id`, for example `P0000000001`. It is unique, uppercase, non-null, concurrency-safe, and cannot be directly updated. |
| `category_id` | FK to a stable category row. |
| `medicine_id` | Optional unique FK to the unchanged operational medicine row. Exactly one product can map to a medicine. |

The code deliberately has no category prefix. Category changes must not change a product's permanent ID. Identity allocation is performed entirely by SQL Server, so browser order, timestamps, restarts, and concurrent requests cannot create collisions.

## Categories

| Stable code | Display name |
|---|---|
| `MEDICINE` | Medicine |
| `BABY_ITEMS` | Baby Items |
| `LAB_ITEMS` | Lab Items |
| `MEDICAL_ACCESSORIES` | Medical Accessories |

Both category code and display name are unique. Application relations use `category_id`, not display strings.

## One source of truth per value

The model supports two mutually exclusive product backings. A database CHECK constraint prevents a row from holding both medicine backing and standalone inventory fields.

| Business value | Medicine-backed product | Standalone non-medicine product |
|---|---|---|
| Product identity | `products.product_id` / computed `product_code` | Same |
| Name | `medicines.name` | `products.standalone_name` |
| Description | `medicines.description` | `products.standalone_description` |
| Selling price | `medicines.unit_price` | `products.standalone_unit_price` |
| Stock | `medicines.quantity` | `products.standalone_quantity` |
| Low-stock threshold | `medicines.min_stock_level` | `products.standalone_min_stock_level` |
| Expiry | `medicines.expiry_date` | Not applicable/null |
| Therapeutic metadata | `medicines.generic_name`, manufacturer, therapeutic `category`, batch | Not applicable |
| Broad catalogue category | `products.category_id` | `products.category_id` |
| Prescription-required flag | `products.prescription_required` | Same |
| Active/inactive | `products.is_active` | Same |
| Image | Product image metadata/path columns | Same |

This conditional-source design does not synchronize duplicate price or stock columns: medicine-backed rows are required to keep every `standalone_*` value null. Existing purchase and sale code continues to update `medicines.quantity`, and catalogue queries see the new value immediately through the live join.

Historical `purchase_items.unit_cost` is a supplier-cost snapshot. Historical `sale_items.unit_price` is the selling-price snapshot recorded at sale time. Neither is a competing current catalogue price.

## Availability

The catalogue derives availability on every query:

1. inactive product -> `INACTIVE`;
2. medicine past expiry -> `EXPIRED`;
3. stock `<= 0` -> `OUT_OF_STOCK`;
4. stock `<= min_stock_level` -> `LOW_STOCK`;
5. otherwise -> `AVAILABLE`.

There is no stored availability label and no catalogue stock counter.

## Existing medicines and future writes

Migration 003 inserts one product mapping for each existing medicine under `MEDICINE`. It does not update medicine IDs or any purchase, sale, or prescription foreign key.

`trg_medicines_product_mapping` creates the mapping for every future medicine insert using the stable Medicine category. The product identity and code are allocated by SQL Server in the same transaction as the medicine insert. Medicine updates require no catalogue synchronization because name, description, price, stock, and expiry are joined live.

## Images

The product table supports original filename, generated stored filename, relative storage path, MIME, and byte size. Metadata is all-null or all-present. Paths must use the managed `products/` prefix and reject `..`, backslashes, and drive separators. MIME is limited to JPEG/PNG and size to 5 MiB.

B1 does not introduce an image mutation/upload workflow. Existing products therefore render the frontend placeholder. A later protected management workflow may write validated files below `backend/uploads/products/` and expose them through a controlled public image endpoint. Base64 and absolute paths are not permitted.

## API contract

Public read routes expose product code, display data, price, stock-derived availability, optional expiry/prescription flags, and safe image URL only. They do not expose supplier cost, private prescription content, user/security data, or absolute storage paths.

No product mutation route is introduced in B1. Staff medicine CRUD remains protected by its existing authorization and future standalone-product administration requires a separately approved role-controlled workflow.
