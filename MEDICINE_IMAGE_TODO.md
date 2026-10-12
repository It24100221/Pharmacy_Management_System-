# Medicine image inventory and remaining work

Inventory captured on 2026-10-10 from SQL Server: **14 products, 14 active, zero existing images, zero verified exact matches, zero imports, 14 requiring manual review**. All records are MEDICINE; there are no baby-care or standalone accessory products to populate.

Each product uses a neutral placeholder consistently. Permanent Product IDs and codes are image keys; medicine IDs are separate relationships. Unknown strength, form or packaging is never inferred.

| Product ID / code | Medicine ID | Actual name | Generic / manufacturer | Explicit strength / form / pack | Decision |
| --- | ---: | --- | --- | --- | --- |
| 1 / P0000000001 | 1 | Amoxicillin 500mg Capsules (100pcs) | Amoxicillin / SmithKline Beecham | 500mg / Capsules / 100pcs | Placeholder: Sandoz 500mg capsules differ from SmithKline Beecham; 100-piece pack unverified. |
| 2 / P0000000002 | 2 | Paracetamol 500mg Tablets (100pcs) | Paracetamol / Cipla Ltd | 500mg / Tablets / 100pcs | Placeholder: Generic 500mg tablets do not establish Cipla manufacturer or 100-piece packaging. |
| 3 / P0000000003 | 3 | Omeprazole 20mg Capsules (30pcs) | Omeprazole / AstraZeneca | 20mg / Capsules / 30pcs | Placeholder: Actavis 20mg capsules differ from AstraZeneca; pack size unverified. |
| 4 / P0000000004 | 4 | Azithromycin 250mg Tablets (6pcs) | Azithromycin / Pfizer | 250mg / Tablets / 6pcs | Placeholder: Source filename says Zithromax, but actual photo shows Sandoz 250mg/6 tablets; database says Pfizer. |
| 5 / P0000000005 | 5 | Atorvastatin 20mg Tablets (30pcs) | Atorvastatin Calcium / Pfizer | 20mg / Tablets / 30pcs | Placeholder: Candidate shows multiple strengths and non-Pfizer 28-piece packages; database is Pfizer 20mg/30 pieces. |
| 6 / P0000000006 | 6 | Ibuprofen 400mg Tablets (50pcs) | Ibuprofen / Boots Pharmaceuticals | 400mg / Tablets / 50pcs | Placeholder: Reviewed 200mg bottle is wrong strength; alternate 400mg tablets do not establish Boots/50-piece identity. |
| 7 / P0000000007 | 7 | Cough Syrup - Honey Lemon (100ml) | Dextromethorphan / Bristol Myers | unknown / Syrup / 100ml | Placeholder: Cocillana contains different ingredients; researched dextromethorphan syrup also has unverified brand/strength/pack. No safe exact match. |
| 8 / P0000000008 | 8 | Cetirizine | Cetirizine / Hemas | unknown / unknown / unknown | Placeholder: Strength, dosage form and pack missing; source is 10mg and does not establish Hemas brand. |
| 9 / P0000000009 | 9 | Cetirizine | Cetirizine / Hemas | unknown / unknown / unknown | Placeholder: Strength, dosage form and pack missing; source is 10mg and does not establish Hemas brand. |
| 10 / P0000000010 | 10 | Amoxiling | Amoxiling / hemas | unknown / unknown / unknown | Placeholder: Name and generic are Amoxiling; active ingredient, strength, formulation and package are unknown. |
| 33 / P0000000033 | 30 | Cetirizine | Cetirizine / Hemas | unknown / unknown / unknown | Placeholder: Strength, dosage form and pack missing; source is 10mg and does not establish Hemas brand. |
| 34 / P0000000034 | 31 | Alovera | Alovera / Hemas | unknown / unknown / unknown | Placeholder: Alovera has no confirmed dosage form; cannot infer aloe vera gel from the name. |
| 35 / P0000000035 | 32 | Vitamin  C | Vitamin C / Hemas | unknown / unknown / unknown | Placeholder: Hemas vitamin C strength, form and pack unknown; round tablet source does not establish these. |
| 36 / P0000000036 | 33 | Vitamin  E | Vitamin E / Hemas | unknown / unknown / unknown | Placeholder: Hemas vitamin E strength, form and pack unknown; source is unbranded and low quality. |

## Completed

- Existing SQL references and local storage reused; attribution, alt text and separate external URL metadata added.
- JPEG/PNG/WebP upload, file preview, URL selection, replacement, removal, authorization and validation implemented.
- Shared API-backed images added to catalogue, medicines/forms/batches/low stock/expiry, POS, customer cart/order items and purchase screens.
- Missing/loading/error states, accessible names, lazy loading and proportional sizing implemented.
- Read-only report and approval-gated importer implemented; existing images are preserved.
- Research sources/licenses are in MEDICINE_IMAGE_CREDITS.md; machine-readable identities are in PRODUCT_IMAGE_MATCHING_REPORT.json.

## Still needed to populate real photos

Obtain exact authorized packaging photos for the 14 records above. Confirm missing identity attributes from stock labels or the pharmacy catalogue. Upload individual verified photos through Edit Medicine, or prepare reviewed entries in backend/data/productImageReview.json. Obtain explicit approval before a bulk database update.

From backend/, run `npm.cmd run prepare:product-image-review` to generate a checklist using actual Product IDs, then `npm.cmd run preview:product-images` to validate reviewed local files and generate `PRODUCT_IMAGE_IMPORT_PREVIEW.json`. Import requires `--import-approved`, `--bulk-update-approved`, and `--approved-plan-sha256=<approved preview digest>` after actual bulk-update approval. Flags are operator assertions, not an automated approval service. Approved entries are currently empty and import mode has not been run. See `PHARMACY_PRODUCT_IMAGE_REPORT.md` for the latest sourcing evidence and local import instructions.
