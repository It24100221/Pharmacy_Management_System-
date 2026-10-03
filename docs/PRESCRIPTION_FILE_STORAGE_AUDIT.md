# Prescription File Storage Audit

Phase: Foundation Stabilization A3

Audit date: 2026-10-03

Database: Microsoft SQL Server (`pharmacy_management`)

## Outcome

Prescription uploads now use authenticated `multipart/form-data`. JPEG and PNG bytes are written below `backend/uploads/prescriptions/` under server-generated UUID filenames. SQL Server stores metadata and a relative storage reference; it does not store new file bytes or base64. PDF is explicitly unsupported.

Files are not mounted through public static middleware. The only retrieval surface is `GET /api/prescription-uploads/:id/file`, protected by JWT, role checks, and customer ownership.

## Entry-state flow

| Layer | Behavior before A3 |
|---|---|
| Frontend | `UploadPrescription.jsx` read the selected file with `FileReader.readAsDataURL`. The checkout caller used the same helper. The UI accepted JPEG, PNG, and PDF and displayed a 10 MB limit, but did not enforce that limit. |
| Payload | JSON shaped as `{ image: "data:<mime>;base64,...", doctorName, notes }`. |
| HTTP | Axios sent `POST /api/prescriptions/upload` as `application/json`. Express accepted JSON bodies up to 10 MB, which was a request-body limit rather than a decoded-file-size rule. |
| Route and authorization | The route required an authenticated `CUSTOMER`; the customer relation came from the canonical JWT-backed database identity, not a payload customer ID. Own/list reads enforced customer ownership and allowed `ADMIN`/`PHARMACIST` staff access. |
| Controller validation | A regular expression accepted data-URL prefixes for JPEG, PNG, or PDF. It trusted the declared prefix, did not inspect magic bytes, did not decode and measure the file, and did not reject empty decoded content. |
| Repository | `createUpload` inserted the complete data URL into `prescription_uploads.image`. |
| Database | `image NVARCHAR(500) NOT NULL`; this could not hold normal image/PDF base64 data. Other columns were `prescription_id`, `customer_id`, `doctor_name`, `notes`, `status`, and `uploaded_date`. No order relation existed and none was invented. |
| Failure behavior | Missing `image` returned 400. Unsupported data-URL prefixes returned 400. Normal files could fail at SQL insertion because the value exceeded `NVARCHAR(500)`. There was no disk file, cleanup path, protected file endpoint, or content retrieval flow. |

## A3 flow

### Frontend and request

- `UploadPrescription.jsx` and the retained checkout upload caller send a `FormData` body.
- File field: `file` (exactly one required).
- Optional string fields: `doctorName`, `notes`.
- Accepted UI types: `image/jpeg`, `image/png`.
- The UI rejects empty files, unsupported browser MIME types, and files over 10 MB for feedback. These checks are not treated as the security boundary.
- The Axios interceptor removes its JSON `Content-Type` override for `FormData`, allowing the browser to add the correct multipart boundary.

### Backend handling and validation

`parsePrescriptionUpload` applies a bounded multipart parser before the controller runs:

- request must be `multipart/form-data`;
- one and only one `file` part must exist;
- file must be non-empty;
- file size must be at most 10,485,760 bytes (10 MiB);
- total multipart input is capped at the file limit plus 128 KiB of form overhead;
- malformed multipart requests return 400;
- oversized uploads return 413.

`prescriptionFileStorage.validateAndDescribe` independently validates:

- buffer existence and integer size;
- declared size equals received buffer length;
- maximum file size;
- declared MIME is exactly `image/jpeg` or `image/png`;
- extension agrees with the MIME (`.jpg`/`.jpeg` or `.png`);
- JPEG or PNG magic signature agrees with the declared MIME;
- original basename is non-empty and at most 255 characters.

PDF returns 415 with an explicit unsupported message. It was not retained because the project has no PDF content-validation/rendering path.

### Filename and path safety

- Stored filenames are generated with `crypto.randomUUID()` and a server-selected `.jpg` or `.png` extension.
- User-provided directory components are removed from the display/original filename.
- Stored references must match `prescriptions/<UUID>.(jpg|png)`.
- Absolute paths, drive paths, backslashes, `..`, and nonconforming filenames are rejected.
- API responses expose only `/api/prescription-uploads/:id/file`, never an absolute filesystem path or raw `storage_path`.
- Runtime files are ignored by Git; the directory is retained by `.gitkeep`.

### SQL metadata

New uploads write these fields to `dbo.prescription_uploads`:

| Field | Purpose |
|---|---|
| `prescription_id` | Upload identity |
| `customer_id` | Existing customer ownership relation |
| `original_filename` | Sanitized display basename |
| `stored_filename` | Generated UUID filename |
| `storage_path` | Safe relative path below the managed upload root |
| `mime_type` | Validated JPEG/PNG MIME |
| `file_size` | Validated byte count |
| `doctor_name`, `notes` | Existing optional metadata |
| `status` | Existing upload status |
| `uploaded_date` | Existing upload timestamp |

The legacy `image NVARCHAR(500)` column is nullable and retained only for compatibility with any pre-A3 rows. New code never writes it. The live database had zero legacy upload rows when migration 002 was applied. There is no `order_id` because no approved order system is deployed.

### Authorization and responses

| Actor | Result |
|---|---|
| Unauthenticated | 401 before route handling |
| Owner `CUSTOMER` | 200 for their own file |
| Different `CUSTOMER` | 403 |
| `PHARMACIST` | 200 |
| `ADMIN` | 200, preserving the approved A2 administrative access matrix |
| `INVENTORY`, `SALES`, `SUPPLIER` | 403 |
| Missing upload record or physical file | 404 |

Successful file responses use the validated MIME, exact length, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`, and a safe content-disposition filename.

### Consistency and cleanup

Upload ordering is deliberate:

1. validate request and content;
2. write the generated file with exclusive-create semantics;
3. insert SQL metadata;
4. return 201 only after both operations succeed.

If the file write fails, the repository insert is never attempted. If SQL insertion fails, the newly written file is removed and the original database error is propagated. Cleanup errors are attached to the original error rather than hiding it.

The live verification script tracks every temporary identity, row, relative path, fixture file, and stored file. Its `finally`-style cleanup removes upload rows before customer/user rows and removes the corresponding managed files. Post-cleanup assertions require zero temporary upload rows and no stored test files. There is intentionally no new end-user delete workflow in A3.

## Verification

Automated backend tests use actual temporary JPEG/PNG files and verify disk round-trips, generated filenames, traversal rejection, unsupported/empty/oversized/mismatched/PDF rejection, SQL-failure file cleanup, and file-failure no-insert behavior.

`npm run verify:prescription-storage` exercises the actual Express API, SQL Server, authentication middleware, and filesystem. It passed for JPEG/PNG upload, metadata, physical files, protected download, all required authorization cases, request validation, public-static denial, and cleanup.
