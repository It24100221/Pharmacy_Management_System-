# Pharmacy product image report

Date: 2026-10-10. Branch: `dev-2`. This report covers the follow-up request to fix missing catalogue photographs.

## Current outcome

**No new verified catalogue photographs have been imported. All 14 products still use neutral placeholders.** Photos with apparently matching packaging were located, but documented reuse permission and final pharmacy product confirmation are still needed. Ambiguous records also lack strength, form or package details.

| Measure | Result |
| --- | ---: |
| Actual SQL Server products | 14 |
| Existing valid assigned images | 0 |
| New verified and authorized assigned images | 0 |
| Products still missing images | 14 |
| Proposed approved bulk updates | 0 |
| Product database records changed by this follow-up | 0 |
| Existing offline licensed research downloads | 12 |
| Successful new downloads in this follow-up | 0 |

There are no baby-care or standalone accessory records in this database. None were created. Existing medicine IDs, Product IDs/codes, prices, stock and expiry dates were preserved.

## Why the catalogue shows placeholders

The rendering path is `PharmacyItems.jsx` → `normalizeCatalogProduct()` → `CatalogueProductImage.jsx`. The actual SQL `image_path` and `image_external_url` references are empty for all 14 records, so the backend returns `image_url: null`. The common component consequently displays its missing-photo state.

This is a missing approved-data issue. Localhost frontend and product API both return HTTP 200; the API includes the correct image fields; the normalizer reads `image_url`; no assigned image request currently fails with 404/403. The lack of assigned images means there is no external-image CORS failure to explain the placeholders. Offline research files are deliberately not served or assigned because they did not match the actual products.

The SQL catalogue has a manufacturer field, rather than a separately confirmed brand field. Strength, form and pack are explicit in only some product names. An unknown value was not inferred from another product or a web search.

## New sourcing evidence

Detailed evidence for every actual product is in `backend/data/productImageSourcingReview.json`. It records exact source pages, licensing status, rejection/confirmation reasons, original image URLs where available, and whether a file was downloaded. This is research data; no runtime code imports these URLs.

| Actual product | Photo/source located | Authorization and matching status |
| --- | --- | --- |
| Product 4: Azithromycin 250mg Tablets (6pcs), Pfizer | [ChumCheck Pfizer Zithromax photo candidate](https://fdasamutsongkhram.org/ChumCheck/product.php?id=510) | Image-search preview shows Pfizer/250mg/6 tablets. Original page could not be retrieved. No reusable license has been established; not downloaded, verified or assigned. [Pfizer's product information](https://www.pfizermedicalinformation.com/zithromax/dosage-forms) confirms that 250mg six-tablet presentations exist. |
| Product 5: Atorvastatin 20mg Tablets (30pcs), Pfizer | [MedeCify Lipitor 20mg/30 product page](https://medecify.com/product/lipitor-20mg-atorvastatin-x30-tabs/) | Page and image-search preview identify Pfizer/20mg/30 tablets. Pharmacy packaging confirmation and photo reuse permission are required. No reusable license established; not downloaded or assigned. |
| Product 1: Amoxicillin 500mg Capsules (100pcs), SmithKline Beecham | [Alphaline Amoxil photograph](https://www.alphalinehealthph.com/product-page/amoxil-500mg-cap) | Search preview shows GSK/500mg/100 capsules. Manufacturer identity and usage permission unconfirmed. Not treated as an exact SmithKline Beecham match. |
| Product 2: Paracetamol 500mg Tablets (100pcs), Cipla | [Cipla 500mg/100 effervescent tablet photograph](https://www.iqdoctor.co.uk/treatments/cough-cold-flu/paracetamol-500mg-effervescent-tablets/) | Effervescent formulation is not confirmed by the SQL entry. Rejected; permission also unverified. Other Cipla photos show 10, 30, 300 or larger bulk packs. |
| Product 3: Omeprazole 20mg Capsules (30pcs), AstraZeneca | [Losec capsule photograph](https://tabletpharmacy.com.pk/products/losec-20mg-capsules) | Actual photographed pack is 14 capsules, not 30. Rejected. |
| Products 6 and 7: Boots ibuprofen / Bristol Myers cough syrup | Existing licensed candidates and further web searches | Boots/50-piece identity is not verified. Cocillana has different ingredients from dextromethorphan. No safe authorized exact photo found. |
| Products 8, 9, 10, 33, 34, 35, 36 | Hemas Cetirizine, Amoxiling, Alovera, Vitamin C and Vitamin E | Strength/form/pack or precise identity missing. Packaging details requested from the user; fallback retained. |

Photographs displayed on a manufacturer or pharmacy website are not automatically licensed for redistribution. [Pfizer's published terms](https://www.pfizer.com/general/terms) restrict reproduction outside the permissions they describe. The source owners' reuse authorization is needed before downloading and importing the unlicensed candidates above. No messages were sent to those owners.

Additional Commons candidates were investigated: [Losec dosage 20mg](https://commons.wikimedia.org/wiki/File:Losec_dosage_20mg.jpg) has a public-domain declaration but incomplete source information and unverified form/pack; [Tony Webster's azithromycin photograph](https://commons.wikimedia.org/wiki/File:Azithromycin_antibiotics_prescription_8285637447_o.jpg) is CC BY-SA 3.0 but its exact manufacturer/pack remains unverified. Both attempted downloads returned HTTP 429. Neither was saved or counted as imported. This is a limitation on those downloads, not a claim that all web access is unavailable.

Previously downloaded candidates, their creators, licenses and transformations remain documented in `MEDICINE_IMAGE_CREDITS.md`. The actual product inventory and all mismatch decisions are in `MEDICINE_IMAGE_TODO.md` and `PRODUCT_IMAGE_MATCHING_REPORT.json`.

## Changes made in this follow-up

- Added `backend/src/services/productImageImportPlan.js`. Preview validates identity, permission assertions, existing-image preservation, regular local files, size, MIME/extension/signature, source URL and metadata; duplicate IDs, missing files, path traversal and changed image hashes are rejected.
- Extended `backend/src/scripts/productImageInventory.js` to generate a proposed bulk-update preview including Product ID/code, identity, filename, MIME, size, source/license, alt text, current reference and SHA-256.
- Added a digest requirement so import refuses an approval for a different preview or changed file. Existing transaction and locked-identity checks are retained.
- Generated `backend/data/productImageReviewTemplate.json` from the 14 actual SQL records. All verification and permission flags are false; it grants no approval.
- Generated `PRODUCT_IMAGE_IMPORT_PREVIEW.json`: zero proposed updates and zero database writes.
- Added `backend/data/productImageSourcingReview.json` with sources and decisions for all 14 products.
- Added `backend/test/productImageImportPlan.test.js` covering file validation, immutable preview data, changed permission/hash, duplicate IDs, traversal and existing images.
- Extended `qa-audit/scripts/productImagesAudit.cjs` to decode an actual licensed research photograph in the shared React component, in a clearly labelled unassigned preview.
- Added `qa-audit/scripts/productImagesProductionAudit.cjs` to start and close an isolated Vite preview server and verify the actual built catalogue, API responses and expired-item restrictions in the browser.
- Updated `backend/package.json`, `MEDICINE_IMAGE_TODO.md`, `PRODUCT_IMAGE_IMPLEMENTATION_REPORT.md` and this report.

No new migration was required. The existing image migrations, upload/URL APIs, shared thumbnails and staff management controls from the preceding implementation were reused. Product-card names, prices, availability text, buttons and styling were not changed by this follow-up.

## Reusable local import process

1. From `backend/`, run `npm.cmd run prepare:product-image-review`. This produces a template of actual Product IDs and current identity attributes. Do not rerun over your edited template without preserving it.
2. Obtain exact authorized files and place them in the existing `backend/assets/products/` directory. Use JPEG/PNG/WebP at up to 5 MB, preserving aspect ratios; prefer optimized WebP. No automatic optimization or download is performed by the importer.
3. For each fully confirmed product, add a reviewed entry to the `approved` array in `backend/data/productImageReview.json`, using the template's permanent Product ID/code and all identity fields. Provide filename, MIME, source URL, license/permission, `verified: true` and `rightsConfirmed: true` only after those statements are confirmed. Leave uncertain products out. A record lacking confirmed strength/form/pack is refused by automatic matching; individually verified photos can instead be attached through Edit Medicine by authorized staff.
4. Run `npm.cmd run preview:product-images`. Inspect `PRODUCT_IMAGE_IMPORT_PREVIEW.json` and request approval for its specific proposed updates. This command performs zero SQL writes.
5. After actual bulk-update approval, run the command below with the approved preview's `planSha256`. Do not run it merely because a source image looks appropriate.

```powershell
npm.cmd run inventory:product-images -- --import-approved --bulk-update-approved --approved-plan-sha256=<approved-preview-digest>
```

The import uses parameterized SQL and generated storage names, refuses existing images, rechecks current locked identity, and rolls back on failure. Only image metadata is changed. The approval flags are operator assertions, not a permission or approval service. **No import command was run in this follow-up.**

## Actual verification

| Check | Final result |
| --- | --- |
| SQL inventory / import preview | 14 actual products; 0 existing images; 0 approved matches; 0 proposed updates; no SQL writes |
| Backend tests | 94 passed, 0 failed |
| Image browser audit | 17 passed, 0 failed |
| Real research JPEG decode | Passed in shared React component; no catalogue product was assigned this mismatched research photo |
| Production build | Passed; existing non-blocking bundle-size warning |
| Production browser smoke check | 14 real records loaded; 0 HTTP errors; 0 uncaught exceptions; expired buttons disabled; no DB writes |
| Real SQL image metadata verification | URL and WebP round trips passed in rolled-back transaction; all product columns unchanged; original medicine identity/stock/price/expiry baseline unchanged |
| Localhost frontend/backend | Both returned HTTP 200 |

Local evidence is in ignored `qa-audit/evidence/`: image browser JSON, desktop/mobile screenshots, `unassigned-real-photo-verification.png`, and production browser JSON/screenshot. Image management mutation checks use isolated browser/API fixtures and do not write SQL product images. They verify preview, validation, replacement/removal and permanent Product ID mapping, including Product 34 versus Medicine 31.

The preceding full interaction audit passed 18/18 and read-only API audit passed 72/72. Those are prior verification results; they are not counted as reruns in this follow-up. No frontend implementation changed in this follow-up.

**Actual catalogue-photo refresh, full restart and Add to cart with an imported real photo remain pending:** there is no verified authorized catalogue photo to import. The browser audit confirms generic image/error rendering and existing catalogue/POS/purchase behavior, and the isolated real-photo preview demonstrates decoding. These results do not establish a successful real-product image import.

## What is needed to finish populating photos

- Confirm the exact packaging of the two Pfizer candidates and supply documented photo reuse permission or authorized replacement files.
- Provide label photos or strength/form/pack details for the Hemas/ambiguous records.
- Obtain matching authorized files for the remaining known products.
- Review the populated import preview and approve the proposed bulk metadata update before application.

The application remains running on `http://localhost:3000`, with backend port 5000. Changes remain uncommitted and unpushed on `dev-2`.
