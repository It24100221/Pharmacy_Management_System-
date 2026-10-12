# Product image implementation report

Date: 2026-10-10. Repository: Pharmacy_Management_System-, branch `dev-2`.

## Result

Image management and consistent image rendering are implemented and tested against the running localhost application. **No researched image passed exact product identity review.** All 14 actual products therefore display a neutral placeholder, as required when a verified and authorized photo is unavailable.

| Measure | Count |
| --- | ---: |
| Products found in SQL Server | 14 |
| Active products | 14 |
| Products with existing images before changes | 0 |
| Newly verified exact image matches | 0 |
| Images imported into SQL product records | 0 |
| Products requiring manual image review | 14 |
| Research photos downloaded and retained offline | 12 |
| Optimized, unapproved WebP research variants | 5 |

All actual products have category MEDICINE. There are no baby-care or standalone healthcare/accessory records. No products were invented to populate those groups.

## Catalogue and image sourcing

`MEDICINE_IMAGE_TODO.md` lists every actual Product ID, product code, linked medicine ID, name, generic, manufacturer, explicit strength/form/pack, and matching decision. `PRODUCT_IMAGE_MATCHING_REPORT.json` contains the machine-readable inventory. `MEDICINE_IMAGE_CREDITS.md` records source URLs, creators, licenses, transformations and rejection reasons for every retained research photo.

Examples of rejected candidates:

- Amoxicillin: Sandoz photo versus SmithKline Beecham catalogue entry.
- Omeprazole: Actavis photo versus AstraZeneca catalogue entry.
- Azithromycin: the file named Zithromax actually shows Sandoz packaging; the catalogue says Pfizer.
- Atorvastatin: mixed strengths and 28-piece non-Pfizer packs versus Pfizer 20mg/30 pieces.
- Ibuprofen: 200mg candidate rejected; a 400mg alternative does not verify Boots/50 pieces.
- Cough syrup: Cocillana has different active ingredients; other syrup packaging remains unverified.
- Cetirizine, vitamins and Alovera: strength/form/pack or precise identity are missing. These attributes were not inferred from search results.
- Amoxiling: active ingredient and exact formulation are unconfirmed.

Research photos are archived outside frontend public assets. No runtime mapping uses them. The initial representative-image approach was removed to satisfy the latest exact-matching rules.

## SQL Server integration

Existing `dbo.products` image reference/file metadata and `dbo.v_product_catalog` were reused. Product IDs and medicine IDs were preserved. No image binary objects were added to SQL Server.

Schema migrations created and applied successfully:

| Migration | Change |
| --- | --- |
| `012_product_image_attribution.sql` | Nullable source URL, license/permission and alt-text fields. |
| `013_product_external_image_url.sql` | Separate nullable HTTPS URL field, preserving local file path constraints and preventing simultaneous local/external references. |
| `014_product_webp_images.sql` | Extends the existing MIME constraint to WebP; JPEG/PNG, file-size, path and complete-metadata checks remain. |

Actual SQL verification initially exposed the existing complete-file/path constraints and JPEG/PNG-only MIME constraint. These were addressed with the separate URL column and WebP migration. The final verification saves and reads both URL and WebP metadata inside a transaction, rolls it back, and confirms every product column is unchanged. Medicine identity, stock, unit price and expiry match the original implementation baseline.

No bulk image update was run. Schema migration history is the only persistent database change from this image task.

## APIs and storage

Existing catalogue responses now include linked medicine ID, generic name, manufacturer, selected image URL/kind, alt text, source and license. Uploaded images use their generated unique file reference as a URL version to refresh cached previews even for replacements within the same second.

| Endpoint | Purpose | Authorization |
| --- | --- | --- |
| `GET /api/products` | Catalogue and selected image metadata | Existing public catalogue access |
| `GET /api/products/:productCode` | Correct product identity and image metadata | Existing public catalogue access |
| `GET /api/products/:productCode/image` | Existing local image delivery or validated external redirect | Public product image |
| `POST /api/products/id/:productId/image` | Upload or replace a file | ADMIN or INVENTORY |
| `PUT /api/products/id/:productId/image-url` | Select an authorized HTTPS image URL | ADMIN or INVENTORY |
| `DELETE /api/products/id/:productId/image` | Clear image references/attribution | ADMIN or INVENTORY |

Uploads accept JPEG/PNG/WebP, enforce matching MIME/extension/signature, require non-empty content up to 5 MB, and use generated UUID filenames. Local paths remain confined to `backend/uploads/products/`. Rights confirmation is required; staff are responsible for verifying permission and exact identity. Metadata is parameterized and length-bounded.

URLs must be public HTTPS without credentials, IP-literal hosts, local/internal hosts or custom ports. The backend does not fetch remote image content. An external host can still change content or availability; broken images render a neutral placeholder. Individual URL uploads do not independently prove copyright or product identity.

Removing an image does not remove its product. Replaced/removed local files are retained for rollback; runtime uploads are ignored by Git. Persist that directory when deploying. There is no automatic old-file retention cleanup in this change.

## Safe matching and import

`npm.cmd run inventory:product-images` from `backend/` is read-only and regenerates the root matching report. Matching requires reviewed permission, permanent Product ID/code, normalized name/generic/manufacturer and explicit strength/form/pack. Unknown identity attributes decline automatic matching.

Approved candidates belong in `backend/data/productImageReview.json`; the approved array is currently empty. The follow-up adds validation of local files and a reviewable `PRODUCT_IMAGE_IMPORT_PREVIEW.json`. Import mode requires `--import-approved`, `--bulk-update-approved` and `--approved-plan-sha256=<approved preview digest>`, after obtaining actual user approval. Flags are operator assertions, not an approval service. Current follow-up results and sourcing evidence are in `PHARMACY_PRODUCT_IMAGE_REPORT.md`.

Import rechecks locked current product and medicine identity, validates local filenames/content, uses parameterized transactional updates, and refuses products with existing local or external images. Failure rolls back SQL updates and removes only files created by that failed import. Application requests never perform web research.

## Frontend screens

- Public pharmacy catalogue: uniform product cards, source/license caption for selected photos, lazy loading, alt text and missing/loading/error states.
- Medicine/inventory list, low stock, expiry and batch details: shared thumbnails resolved by permanent product code or the explicit linked medicine relationship.
- Add Medicine: neutral preview and instructions to save the medicine before attaching a photo to its permanent Product ID.
- Edit Medicine: current/file preview, upload validation, URL/source/license fields, permission confirmation, save/replace/remove controls and refreshed catalogue metadata.
- POS: medicine search and selected cart thumbnails.
- Customer checkout and order details: shared product thumbnails.
- Purchase entry and purchase-order details: shared product thumbnails.

Square thumbnails and larger previews preserve aspect ratios using `object-fit: contain`. Failed URLs stop rendering the failed image instead of recursively requesting another URL. Existing stock/expiry, pricing, prescription requirements and purchase/sale handlers were preserved.

## Verification results

| Verification | Final result |
| --- | --- |
| Backend `npm.cmd test` | 91 passed, 0 failed |
| Frontend `npm.cmd test` | 30 passed, 0 failed |
| Frontend `npm.cmd run build` | Passed |
| Backend `npm.cmd run verify:api-readonly` | 72 passed, 0 failed; 58 endpoints and 14 validation cases; zero database writes |
| Backend `npm.cmd run verify:product-image-metadata` | URL and WebP SQL round trips passed; transaction rolled back; all product columns unchanged; original medicine baseline unchanged |
| `node qa-audit/scripts/productImagesAudit.cjs` | 16 passed, 0 failed |
| Existing `node qa-audit/scripts/safeInteractionAudit.cjs` | 18 passed, 0 failed |
| `git diff --check` | Passed |

Browser testing used the actual localhost catalogue and staff inventory/POS/purchase screens. It verified all 14 intentional placeholders, product-code search/category filter, mobile width 390px, proportional loaded images, stable broken-image fallback, edit/add controls, inventory thumbnails, POS search/cart and purchase search/selected items. Staff mutation fixtures verified invalid uploads, blob preview, upload to Product 34 rather than Medicine 31, URL replacement and confirmed removal without SQL writes. No uncaught application exceptions were recorded.

Loaded-image/failed-image and mutation scenarios used clearly identified browser or API fixtures. They do not represent imported catalogue photos. HTTP tests exercised the real Express routes and local file storage with isolated repository fixtures, including reopening the server listener and reading the stored file. SQL tests used the real database. A full restart with an approved real catalogue photo was not exercised because no exact authorized photo was available; that remains a check when the first approved photo is assigned.

Generated browser evidence is local and ignored by Git: `qa-audit/evidence/product-images-browser.json`, desktop/mobile screenshots, and the existing interaction audit report. The build has a non-blocking warning for the existing combined JavaScript bundle above 500 kB.

## Remaining work and constraints

1. Obtain exact authorized photos and confirm missing identity attributes for the 14 products. The current fallback result is intentional; zero real catalogue photos have been integrated.
2. Review/import only verified candidates. Bulk image assignments still require approval. Existing selected images must be preserved unless staff intentionally replace them.
3. Verify refresh and full application restart with the first approved real product photo; current fixture/SQL checks cover the storage and metadata mechanisms.
4. One additional research download was rejected by automatic approval review because of its usage limit. It was not an exact verified match and is not needed by the application. The source is recorded in the credits.

The project remains running at `http://localhost:3000` with the backend on port 5000. These changes have not been committed, pushed or deployed.

## Changed files

The implementation file list follows; research binaries are grouped by directory.

- `MEDICINE_IMAGE_CREDITS.md`
- `MEDICINE_IMAGE_TODO.md`
- `PRODUCT_IMAGE_IMPLEMENTATION_REPORT.md`
- `PRODUCT_IMAGE_MATCHING_REPORT.json`
- `backend/assets/image-review/README.md`
- `backend/assets/products/README.md`
- `backend/data/productImageReview.json`
- `backend/src/scripts/productImageInventory.js`
- `backend/src/scripts/verifyProductImageMetadata.js`
- `backend/src/services/productImageMatching.js`
- `backend/src/services/productImageMetadata.js`
- `backend/test/productImageRoutes.test.js`
- `backend/test/productImages.test.js`
- `backend/uploads/products/.gitkeep`
- `database/mssql/migrations/012_product_image_attribution.sql`
- `database/mssql/migrations/013_product_external_image_url.sql`
- `database/mssql/migrations/014_product_webp_images.sql`
- `frontend/src/components/CatalogueProductImage.jsx`
- `frontend/src/components/ProductImageManager.jsx`
- `frontend/src/components/ProductThumbnail.jsx`
- `frontend/src/context/ProductImagesContext.jsx`
- `qa-audit/scripts/productImagesAudit.cjs`
- `.gitignore`
- `backend/package.json`
- `backend/src/controllers/productController.js`
- `backend/src/middleware/productImageUpload.js`
- `backend/src/repositories/productRepository.js`
- `backend/src/routes/productRoutes.js`
- `backend/src/services/productImageStorage.js`
- `frontend/src/main.jsx`
- `frontend/src/pages/CheckoutPage.jsx`
- `frontend/src/pages/Medicines/AddMedicinePage.jsx`
- `frontend/src/pages/Medicines/EditMedicinePage.jsx`
- `frontend/src/pages/Medicines/ExpiryPage.jsx`
- `frontend/src/pages/Medicines/LowStockPage.jsx`
- `frontend/src/pages/Medicines/MedicineBatchesPage.jsx`
- `frontend/src/pages/Medicines/MedicineListPage.jsx`
- `frontend/src/pages/OrderDetails.jsx`
- `frontend/src/pages/PharmacyItems.jsx`
- `frontend/src/pages/Purchases/CreatePurchasePage.jsx`
- `frontend/src/pages/Purchases/PurchaseOrderDetailsPage.jsx`
- `frontend/src/pages/Sales/POSPage.jsx`
- `frontend/src/services/apiService.js`
- `frontend/src/styles/customer.css`
- `frontend/src/utils/normalization.js`
- `backend/assets/image-review/originals/*.jpg` (12 licensed, unapproved research candidates)
- `backend/assets/products/*.webp` (5 optimized, unapproved candidates)
