# Authentication Flow Audit

Phase: Foundation Stabilization A2

Audit date: 2026-10-03

Database: Microsoft SQL Server (`pharmacy_management`)

## Scope

This audit covers the existing authentication routes, controller and repository, JWT and role middleware, frontend auth/application contexts, protected routing, API interceptors, login pages, logout behavior, and browser storage. A2 changes are limited to authentication, authorization, ownership, and lifecycle stabilization; no new business workflow was added.

## Flow summary

```text
LOGIN INPUT
  -> BACKEND AUTH API
  -> USER LOOKUP
  -> BCRYPT VERIFY
  -> JWT CREATION
  -> FRONTEND STORAGE
  -> ROLE REDIRECT
  -> PROTECTED API ACCESS
```

| Step | A2 entry status | Finding at audit start | A2 result |
|---|---|---|---|
| Login input | IMPLEMENTED | Separate customer and staff forms existed, but `/login` skipped the existing chooser. | IMPLEMENTED: `/login` presents customer/staff choices; both dedicated forms remain reachable. |
| Backend auth API | IMPLEMENTED | Customer and staff login APIs existed. No authenticated session-validation endpoint existed. | IMPLEMENTED: existing login APIs retained and `GET /api/auth/me` validates/restores a stored session. |
| User lookup | PARTIAL | Login looked up SQL users by username/customer email/staff email and filtered the login type by role. JWT middleware trusted token claims without confirming the user still existed. | IMPLEMENTED: every protected request reloads the current user and role from SQL Server; deleted/unknown users receive 401. |
| Bcrypt verify | IMPLEMENTED | Login used `bcrypt.compare`; customer registration used cost 12. The seeded supplier hash did not match the documented development credential. | IMPLEMENTED: bcrypt behavior retained; supplier seed and live hash repaired and verified through the HTTP login API. |
| JWT creation | UNSAFE | JWT used a known fallback secret and carried role/customer authorization claims for the full token lifetime. | IMPLEMENTED: a 32+ character `JWT_SECRET` is mandatory, tokens contain only `userId`, expire after 8 hours, and include issuer/audience. |
| Frontend storage | PARTIAL | Token/session were stored, while operational and customer data could remain in role-specific local caches. | IMPLEMENTED: only the auth session/token are persisted for restoration; legacy sensitive caches and cart storage are cleared on logout or invalid session. |
| Role redirect | PARTIAL | Role redirects existed but route allow-lists were broader than backend access and `/login` was customer-only. | IMPLEMENTED: each SQL role has an explicit dashboard path and protected routes use matching least-privilege allow-lists. No email-based routing is used. |
| Protected API access | BROKEN | `AppContext` fetched protected operational datasets before authentication and treated authorization failures as API/offline failure. | IMPLEMENTED: protected data loads only after authentication and only for the current role. 401, 403, and transport failure remain distinct. |

## Backend authentication

### Login APIs

- `POST /api/auth/customer-login` (and the retained alias `/api/auth/customer/login`) accepts customer username or email and only resolves `CUSTOMER` users.
- `POST /api/auth/staff-login` accepts staff username or email and only resolves the existing staff roles: `ADMIN`, `PHARMACIST`, `INVENTORY`, `SALES`, and `SUPPLIER`.
- Passwords are verified with bcrypt. Invalid credentials return 401 with a generic message.
- Successful login returns an 8-hour JWT and the canonical identity needed by the frontend: user ID, username, role, optional customer ID, and display name.

### JWT creation and validation

- The application asserts `JWT_SECRET` during backend startup. Missing or shorter-than-32-character values stop startup with a clear configuration error.
- The committed example contains only `JWT_SECRET=<strong-secret-here>`; the real local value remains in ignored `backend/.env`.
- Tokens are signed with issuer `pharmacy-management-api`, audience `pharmacy-management-web`, and an 8-hour expiry.
- Middleware rejects missing, malformed, bad-signature, wrong issuer/audience, and expired tokens with 401.
- After signature validation, middleware reads the current SQL user by `userId`. The database role and customer relationship replace any stale or forged token claims.
- A token for a deleted/unknown user returns 401. A valid user outside a route allow-list returns 403.
- Error responses do not contain the secret or a stack trace.

### Session validation

`GET /api/auth/me` runs the same JWT and current-user validation as every protected route. It returns identity but does not mint a replacement token. The frontend uses it to restore a saved session after refresh.

## Frontend lifecycle

### Explicit states

The frontend distinguishes:

- `AUTH_INITIALIZING`: stored authentication is being inspected or validated.
- `UNAUTHENTICATED`: no usable session exists, or the API returned 401.
- `AUTHENTICATED`: identity has been established.
- `API_UNAVAILABLE`: no HTTP response was received from the API.
- `FORBIDDEN`: the API returned 403 for the authenticated identity.

### Startup and refresh

1. `AuthContext` reads the stored session.
2. Missing, malformed, incomplete, or locally expired sessions are cleared without a protected request.
3. A usable stored session is validated with `/api/auth/me`.
4. A 401 clears the session and returns to the login experience.
5. A network failure preserves the candidate session and displays an API-unavailable retry state.
6. Only after authentication does `AppContext` load the datasets listed for the current role.
7. Logged-out startup loads no protected operational datasets. The public product catalogue uses `/api/products` directly.

### Login

1. The selected customer/staff login API is called.
2. The returned identity and token are saved.
3. Auth state changes immediately to authenticated and clears stale outage errors.
4. `AppContext` reacts to the new session and loads only the role data scope.
5. The login form uses the stored SQL role to navigate to the configured dashboard with history replacement.
6. No refresh is required.

Role data scopes:

| Role | Automatic protected data after login |
|---|---|
| CUSTOMER | None; customer pages request only their own data as needed |
| PHARMACIST | Medicines, customers, prescriptions |
| INVENTORY | Medicines, suppliers |
| SALES | Medicines, customers, sales |
| SUPPLIER | Suppliers |
| ADMIN | Medicines, suppliers, customers, prescriptions, sales |

### Logout

Logout clears the in-memory identity, JWT/session keys, legacy operational/customer cache keys, and customer cart. It dispatches a logout event so all providers clear their in-memory state, then replaces the current location with `/login`. Browser Back and direct protected-route navigation are handled by `ProtectedRoute` and return to login; no SQL data is deleted.

## HTTP error handling

| Condition | Classification | Behavior |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Authenticated requests dispatch session invalidation; protected UI returns to login. Never treated as offline. |
| 403 | `FORBIDDEN` | The authenticated session remains distinct from an outage. Never treated as offline. |
| No response / transport failure | `API_UNAVAILABLE` | A clear retry state is shown. A stored candidate session is retained for recovery. |
| Other HTTP error | `API_ERROR` | The operation fails with its server/user-facing error; it is not relabeled as an outage. |

## Browser and HTTP verification

The actual Express API and SQL Server were exercised with temporary customer accounts. The accounts and test upload were removed afterward. Live checks passed for public access, unauthenticated rejection, all customer ownership cases, each staff role's allowed and blocked route, supplier login, and SQL/API medicine equality.

A headless Microsoft Edge run against the real Vite application verified:

- fresh logged-out `/login` made zero protected operational API calls;
- both customer and staff login choices were visible;
- inventory login reached `/inventory-dashboard` without refresh;
- refresh restored the session through the API;
- logout cleared auth and sensitive cache keys;
- browser Back and direct protected navigation did not restore protected content;
- intercepted API failure displayed the outage state without discarding the session;
- removing the failure and selecting Retry restored the dashboard.

A second browser pass authenticated every stored role and confirmed its exact redirect: customer, pharmacist, supplier, inventory, sales, and admin all reached the dashboard documented in the authorization matrix without a refresh.
