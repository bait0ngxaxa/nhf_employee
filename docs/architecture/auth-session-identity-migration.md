# Phase J0 — Auth / Session / Identity Discovery & Boundary Definition

Historical status: **Phase J0 CLOSED — discovery and boundary definition
complete.**
Current status: **Phase J3 CLOSED — LINE/LIFF identity integration and Auth
Audit producer migration complete. The Auth / Session / Identity migration is
COMPLETE.**

Audited baseline: `6021618941206d9cb204318ff8daf0c90e83d66b`
(`feat(audit): close I3 producer integration and persistence exclusivity`)

This record is authoritative for the Auth / Session / Identity migration. The
J0 sections record the implementation that existed at the audited baseline,
the ownership decisions supported by that evidence, and the behavior that
later phases must preserve. The J1 implementation record at the end documents
the completed server ownership move. J1 does not change API contracts,
cookies, token contents/TTLs, Prisma schema, UI, LINE/LIFF behavior, or Auth
Audit producers.

Sections 1–28 retain historical J0–J2 snapshots and closure decisions. Any
phrase such as “current behavior”, “not started”, or a pre-J3 LINE/LIFF
limitation in those sections is scoped to that historical baseline. Section 29
and the current runtime-hardening record supersede those snapshots for the
post-J3 implementation.

## 1. J0 scope and closure

J0 covered repository-wide discovery of:

- web credential, access-token, refresh-token, and session-family behavior;
- current-user and workforce projections;
- User account, Employee eligibility, and account lifecycle coordination;
- generic and feature-specific authorization;
- signup, password recovery, session listing/revocation/cleanup;
- LINE ID-token verification, account linking, and LIFF session bridging;
- Auth-originated Audit producers;
- security/platform, database, Email, browser, Dashboard, and LIFF consumers;
- production Prisma access, tests, contracts, invariants, risks, and migration
  seams.

J0 is closed because the evidence answers the ownership questions that would
materially affect J1. The future module names are intentionally not treated as
the decision: the decision is the responsibility boundary and the allowed
contracts. J1-J3 may choose final directory names without changing that
boundary.

The following facts remain external to this repository and are therefore not
silently guessed:

1. The deployment scheduler or operator that invokes
   `POST /api/auth/cleanup` is not defined in the repository. The route and its
   seven-day retention behavior are recorded here; production scheduling is an
   operational follow-up.
2. The production topology and process count for the in-memory rate-limit maps
   are not encoded in the repository. Their current process-local semantics
   are an invariant for this migration and a later operational/security risk.

Neither item prevents the J1 ownership seam from being defined.

## 2. Discovery methodology and evidence

The discovery used the actual production call graph, not directory names:

1. Confirmed the clean starting worktree, branch, and audited commit.
2. Read the existing architecture records, especially the completed Employee
   F0-F3 and Audit I0-I3 records, before defining a new boundary.
3. Read all files under `lib/auth/**` and all routes under `app/api/auth/**`,
   then followed their imports into Employee, Leave, Prisma, security, Audit,
   Email, and LINE infrastructure.
4. Searched production code for direct `User`, `AuthRefreshToken`,
   `PasswordResetToken`, and `LineAccountLink` delegate operations and
   separated those results from tests, fixtures, schema, migrations, and
   generated code.
5. Traced browser entry points, providers, API clients, Dashboard composition,
   session-management UI, and LIFF recovery behavior.
6. Read the relevant route, helper, integration, unit, and component tests to
   identify behavioral contracts and concurrency guarantees.

Primary evidence includes:

| Evidence | What it establishes |
| --- | --- |
| `lib/auth/**` | Current auth helpers, hybrid token/session mechanics, workforce guards, projections, rate limits, and compatibility types. |
| `app/api/auth/**` | The actual HTTP use cases, status/response behavior, transaction boundaries, cookies, and Audit timing. |
| `prisma/schema.prisma` | User, Employee, AuthRefreshToken, PasswordResetToken, LineAccountLink fields, constraints, relations, and indexes. |
| `docs/architecture/employee-migration.md` | The completed Employee ownership decision and its narrow Auth/workforce/signup contracts. |
| `docs/architecture/audit-migration.md` | The completed Audit persistence boundary and deferred Auth producer seam. |
| `docs/architecture/leave-migration.md` | Leave capability ownership and the public predicates currently consumed by Auth. |
| `components/auth/**`, `lib/client/**`, `middleware.ts` | Browser state, refresh/retry, redirect, and client/server responsibilities. |
| `lib/line/**`, `lib/auth/liff.ts`, `app/api/line/**` | LINE identity, account-link, LIFF session, and messaging behavior. |
| `__tests__/**` and migrated-module tests | Security, concurrency, API, UI, and integration contracts. |

## 3. Current architecture

The current system is a single Next.js modular monolith. Auth has not yet been
migrated into `modules/`; its operational implementation is split between the
legacy `lib/auth/**`, `lib/line/**`, platform helpers, App Router routes, and
browser components.

The observed web flow is:

```text
Browser / middleware
    -> app/api/auth/** or app pages
    -> lib/auth/** compatibility and application helpers
    -> Prisma User / AuthRefreshToken / PasswordResetToken
    -> modules/employee and selected modules/leave public contracts
    -> lib/server/audit compatibility adapter -> modules/audit public API
```

The observed LINE/LIFF flow is separate in transport but currently mixed in
implementation:

```text
LINE LIFF browser
    -> app/api/line/**
    -> lib/line verification/link/session helpers
    -> lib/auth/liff workforce resolution and Leave capability query
    -> Prisma User / Employee / LineAccountLink / LeaveRequest
    -> modules/leave, routine, or stock LIFF routes
```

The target dependency direction remains the repository convention:

```text
HTTP or page route
    -> capability public server contract
    -> application/domain
    -> infrastructure/persistence

Client entry -> HTTP contract only
```

The current code has not reached that shape for Auth. This record does not
pretend that it has.

### 3.1 Current Auth implementation inventory

The complete production `lib/auth/**` surface audited in J0 is:

| Path | Observed responsibility |
| --- | --- |
| `lib/auth/types.ts` | Broad `AuthenticatedUser` and `HybridAuthSession` projection types. |
| `lib/auth/context.ts` | Narrow numeric `UserContext` construction for API/application consumers. |
| `lib/auth/api.ts` | `requireApiSession` and generic `requireAdminSession` response helpers. |
| `lib/auth/server.ts` | Web access-cookie verification, active-family/account resolution, and broad Employee/Department/Leave projection. |
| `lib/auth/ssot.ts` | Access-claim validation, User selects, and Auth/Signup/Recovery messages. |
| `lib/auth/hybrid/constants.ts` | Web cookie names and access-token secret key configuration. |
| `lib/auth/hybrid/tokens.ts` | JWT issue/verify, opaque refresh generation/hash, TTL, and refresh draft. |
| `lib/auth/hybrid/session.ts` | Cookie options, metadata extraction, cookie setting/clearing, and User-id parsing. |
| `lib/auth/hybrid/session-store.ts` | Active refresh-family lookup. |
| `lib/auth/hybrid/route.ts` | Request-based web User-id and current-family resolution. |
| `lib/auth/workforce.ts` | Active User/Employee workforce guards and explicit admin bypass. |
| `lib/auth/workforce-transaction.ts` | Transaction-bound User/Employee lock and active-state guard. |
| `lib/auth/employee-account-lifecycle.ts` | Account activation/deactivation, last-admin/self checks, identity sync, token-version and refresh revocation. |
| `lib/auth/liff.ts` | LIFF workforce identity validation and mixed feature/Leave capability projection. |
| `lib/auth/csrf.ts` | Trusted-origin/XHR mutation wrapper. |
| `lib/auth/mutation-headers.ts` | Client mutation header constant. |
| `lib/auth/rate-limit.ts` | Auth-specific process-local identity/IP attempt limiter. |
| `lib/auth/return-path.ts` | Safe internal redirect validation. |
| `lib/auth/client.ts` | Browser hybrid refresh single-flight, 401 refresh/replay, and best-effort logout. |

The complete direct Auth route surface audited is:
`hybrid-login`, `refresh`, `logout`, `logout-all`, `me`, `sessions`,
`sessions/revoke`, `cleanup`, `signup`, `forgot-password`, and
`reset-password` under `app/api/auth/**`.

## 4. Authentication lifecycle

### 4.1 Web login

`POST /api/auth/hybrid-login` in
`app/api/auth/hybrid-login/route.ts` currently performs the following sequence:

1. `withTrustedMutation` requires an exact trusted `Origin` and
   `X-Requested-With: XMLHttpRequest`.
2. The generic pre-auth IP limiter runs before request parsing and uses the
   `auth-login` policy: 300 requests per 15 minutes per trusted IP.
3. The body is validated as an email and a non-empty password. The email is
   trimmed and lower-cased.
4. The Auth-specific in-memory limiter uses the normalized email and trusted
   IP: eight attempts per identity and 40 attempts per IP per 15 minutes.
5. The route reads the User using `authLoginUserSelect`, compares the password
   with bcrypt, requires an active/non-deleted User, and applies
   `hasEligibleEmployeeLifecycle` to the linked Employee. The Employee
   predicate deliberately treats `null` as eligible, so a User with no linked
   Employee can currently log in.
6. On failure, the route records the attempt, emits best-effort `LOGIN_FAILED`,
   and returns the same `Invalid email or password` 401 response for missing,
   invalid, inactive, deleted, or ineligible cases.
7. On success, it creates a new refresh-token draft and family, signs an
   access token, persists the refresh row, emits best-effort `LOGIN_SUCCESS`,
   and returns the current login response with both cookies.

Access-token signing, refresh-row creation, Audit append, and cookie response
are separate effects, not one database transaction. Signing or refresh-row
persistence failure takes the current generic 500 path; Audit is best effort
and its failure is swallowed; cookies are set only after the preceding
successful steps.

### 4.2 Auth route contract inventory

| Route | Current use case and contract |
| --- | --- |
| `POST /api/auth/hybrid-login` | Trusted mutation; 400 invalid payload, 401 indistinguishable credential/inactive response, 429 Auth limit; creates an access token and refresh family; returns `{ success: true, user: { id, email, name, role } }`. |
| `POST /api/auth/refresh` | Trusted mutation; pre-auth IP limit; hashes opaque cookie, checks row/user, atomically rotates the refresh row, signs a new access token, and sets both cookies. Unknown, expired, revoked, inactive-user, or detected-race cases return 401 and clear cookies. |
| `POST /api/auth/logout` | Trusted mutation; hashes the refresh cookie and revokes that refresh row only; best-effort `LOGOUT`; always clears both cookies on the normal success path. |
| `POST /api/auth/logout-all` | Trusted mutation; resolves the current web identity, revokes every active refresh row for that User, best-effort `LOGOUT`, and clears both cookies. |
| `GET /api/auth/me` | Resolves `getApiAuthSession()` and returns `{ user: session.user }`; 401 when the projection cannot be resolved. |
| `GET /api/auth/sessions` | Resolves the authenticated User and current family, then returns active/unexpired refresh rows with device metadata and `isCurrent`. |
| `POST /api/auth/sessions/revoke` | Trusted mutation; validates a session-row id, checks ownership, revokes the entire matching family, emits `LOGOUT`, and clears cookies if it was the current family. The UI name says session, but the operation is family-wide. |
| `POST /api/auth/cleanup` | Secret-header-only maintenance route; deletes revoked or expired refresh rows older than seven days and returns `deletedCount`. It does not use a user session. |
| `POST /api/auth/signup` | Trusted mutation; validates the organization email/password, performs Employee lookup and serializable lock/recheck, creates the User, emits `USER_CREATE`, and returns 201. It does not create a session; the browser calls hybrid login afterward. |
| `POST /api/auth/forgot-password` | Public recovery request; applies in-memory and database request limits, preserves anti-enumeration success wording, creates a one-hour hashed reset token, and asks Email transport to send a link. No Auth Audit event is currently emitted. |
| `POST /api/auth/reset-password` | Public reset command; validates token/password, atomically claims the one-time token, updates the password, increments `tokenVersion`, revokes active refresh rows, emits best-effort `PASSWORD_RESET`, clears cookies, and returns the existing success/error wording. |

## 5. Authentication and session cryptography

### 5.1 Access token

The current implementation is in
`lib/auth/hybrid/tokens.ts` and `lib/auth/hybrid/constants.ts`.

| Property | Current behavior |
| --- | --- |
| Algorithm | HMAC JWT, `HS256`, verified with `AUTH_ACCESS_TOKEN_SECRET`. The trimmed secret is required. |
| Subject | `sub` is the decimal User id string. Parsing accepts only a positive integer. |
| Claims | `role`, `sid` (refresh family id), and `ver` (User `tokenVersion`), plus `iat` and `exp`. Required-claim validation requires non-empty `sub`, `role`, `sid`, and an integer non-negative `ver`. |
| Default lifetime | 15 minutes (`900` seconds), configurable only by the positive-integer `AUTH_ACCESS_TOKEN_TTL_SECONDS`. |
| Role authority | The JWT contains `role`, but the server current-user projection reads the current User role from the database. Middleware validates only signature/required claims; it is not the authoritative account/session check. |
| Version authority | Web API resolution compares `claims.ver` to the current User `tokenVersion`. |
| Failure behavior | Verification/parsing/database/projection failures collapse to unauthenticated in the relevant helper; routes return their existing 401/403/500 contracts. |

### 5.2 Refresh token and family

Refresh tokens are opaque values generated from 48 random bytes and encoded as
base64url. Only the SHA-256 hex digest is persisted in
`AuthRefreshToken.tokenHash`; the raw value is returned to the caller solely
to set the HttpOnly cookie. A new family id is 16 random bytes encoded as hex.

The default refresh lifetime is 30 days, configurable by the positive-integer
`AUTH_REFRESH_TOKEN_TTL_SECONDS`. A persisted row records User id, unique hash,
family id, expiry, optional user agent/IP, optional unique `rotatedFromId`,
revocation time, last-use time, and timestamps.

The current rotation algorithm is:

```text
refresh cookie
    -> SHA-256 lookup by unique tokenHash
    -> reject/revoke family when row is revoked or expired
    -> reject/revoke family when User.isActive is false
    -> transaction:
         conditional update old row where revokedAt is null
         if claimed: create same-family successor with unique rotatedFromId
         if not claimed: find active/unexpired successor
    -> concurrent successor / rotatedFromId conflict:
         treat as already rotated, revoke the family, return 401
    -> success: sign access JWT and set new access + refresh cookies
```

The conditional update and unique `rotatedFromId` constraint provide the
current concurrent-refresh protection. A losing concurrent refresh is treated
as reuse/race and revokes the family, including a successor that another
request may have just created. This behavior is covered by the existing race
tests and must not be changed silently.

The refresh precheck currently selects `id`, `email`, `role`, `isActive`, and
`tokenVersion`; it does not itself check `User.deletedAt` or Employee status.
The later web request/session projection does more validation. That difference
is recorded as a compatibility risk, not redesigned in J0.

### 5.3 Revocation semantics

- `logout` revokes the refresh row represented by the current refresh cookie.
- `logout-all` revokes all currently unrevoked refresh rows for the User.
- individual session revocation revokes every currently unrevoked row in the
  selected family, not just the selected row.
- Employee OFFBOARD/SUSPEND lifecycle operations revoke active refresh rows and
  increment `User.tokenVersion` in the same Employee lifecycle transaction.
- Password reset increments `tokenVersion` and revokes active refresh rows in
  the same serializable transaction.
- Logout operations do not increment `tokenVersion`; their immediate web
  validity comes from family revocation and cookie clearing.
- Cleanup removes rows only when their revoked/expiry timestamp is more than
  seven days old. No retention migration is part of J0.

### 5.4 Cookies

Web cookies are:

- `__Host-nhf_at` for the access JWT;
- `__Host-nhf_rt` for the opaque refresh token.

Both are set with `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and a
`Max-Age` matching the corresponding token lifetime. Clearing uses the same
attributes and `Max-Age=0`. The `__Host-` names imply the current host-only
scope; no Domain attribute is set. No JWT or refresh raw value is exposed to
browser JavaScript.

The LIFF cookie is intentionally different and is documented in section 13:
`nhf_liff_session`, HttpOnly, SameSite=Lax, root path, and Secure only in
production.

## 6. Session resolution and current-user projection

### 6.1 Current server projections

`lib/auth/types.ts` defines the broad current client-safe shape:

```text
AuthenticatedUser {
  id: string
  role: string
  email?: string | null
  name?: string | null
  department?: string
  isManager?: boolean
  canApproveLeave?: boolean
  canViewLeaveReports?: boolean
}
```

`HybridAuthSession` currently contains only `{ user: AuthenticatedUser }`, but
the `user` object is broader than authentication identity.

`lib/auth/server.ts::getApiAuthSession()` does all of the following:

1. reads only the access cookie;
2. verifies the JWT and parses the User id;
3. loads an active, non-deleted User with Employee, Department name,
   subordinate existence, and Leave approval relations;
4. checks an active, unexpired refresh row in the claimed family;
5. requires a linked Employee and
   `hasEligibleEmployeeLifecycle(employee)`;
6. compares `claims.tokenVersion` with `User.tokenVersion`;
7. performs a second Leave history query; and
8. serializes the current projection using `getUserDisplayName`.

This means `/api/auth/me`, Dashboard server layouts, login-page redirects,
home-page redirects, `requireApiSession`, and `requireAdminSession` inherit
Employee, Department, and Leave query behavior today.

`lib/auth/context.ts::buildUserContext()` narrows that broad projection for
API services to numeric `id`, `role`, `email`, and nullable `name`. It parses
the string session id and uses safe fallback values. `requireAdminSession`
adds only the generic `isAdminRole` check.

`lib/auth/hybrid/route.ts::resolveAuthenticatedUserId()` is a separate route
helper. It verifies the access token, active family, active/non-deleted User,
matching token version, and Employee status when an Employee exists. It treats
a missing Employee as acceptable. It therefore has intentionally different
semantics from `getApiAuthSession()`, which currently requires an Employee.

`lib/auth/workforce.ts` then resolves User and Employee again for operations
that require an active workforce account. Admin bypass is available only in
the explicit `requireActiveWorkforceOrAdminSession` composition helper.
Transaction-sensitive features use
`lib/auth/workforce-transaction.ts` or their own equivalent to lock User and
Employee rows and recheck active state.

### 6.2 Field-by-field projection audit

| Current field | Current reason for computation | Current consumers | Semantic classification | Future boundary |
| --- | --- | --- | --- | --- |
| `id` | JWT subject/User lookup and API actor identity | Every authenticated API, ownership checks, notifications, Stock/Routine/Leave commands, Audit actor | Stable account identity | Auth/Session principal; exposed as an opaque numeric/string identifier according to existing contracts. |
| `role` | DB role is serialized and checked by `isAdminRole` | Generic admin routes, Dashboard menu, Stock/Routine/Leave composition, Email Request, Audit routes, LIFF feature gates | Generic account authorization input, not feature capability | Auth owns the account role; each capability interprets it in its own policy. |
| `email` | Login identifier, Audit actor/reference, contact/display | Navbar, AuthStatus, Email Request, Audit, notification/email producers | Credential/login identity plus reusable contact data | Auth owns login identity and account-safe exposure; business consumers own contact meaning. |
| `name` | `getUserDisplayName` prefers canonical Employee identity with User fallback | Login response, Dashboard home/navbar/sidebar, AuthStatus, notification/email payloads | Account display projection; canonical workforce identity is Employee | Auth may expose an account fallback; Dashboard/Employee composition supplies canonical workforce display. |
| `department` | `findActiveUser` joins Employee -> Department and serializes the name | Dashboard home, navbar, AuthStatus | Employee/Department presentation projection | Not generic Auth-owned; app/Dashboard composes it from Employee/Department or an equivalent stable projection. |
| `isManager` | Employee subordinate existence (`take: 1`) | Leave Dashboard tests/visibility model and current projection shape | Employee hierarchy projection | Employee/Leave/application composition; not generic Auth authorization. |
| `canApproveLeave` | Employee subordinates plus Leave actionable approvals/exception approvals | Leave Dashboard tabs; current `/me` and tests | Leave business capability authorization | Leave owns the predicate; `/me` composition may preserve the field through a Leave contract. |
| `canViewLeaveReports` | Employee manager status plus Leave approval history | Leave Dashboard report tab; current `/me` and tests | Leave business capability/presentation projection | Leave owns the rule; app composition may preserve the response field. |

### 6.3 Required migration seam for the broad projection

The existing `/api/auth/me` response and Dashboard/Leave UI are compatibility
contracts. J0 does not remove the fields. The future split is:

```text
Auth/Session -> stable authenticated principal + generic account identity
Employee/Department -> workforce/display projection
Leave -> Leave capability projection
Dashboard/app composition -> combines those values into the existing /me/UI shape
```

The composition adapter must preserve the current values and absence behavior
while generic Auth stops importing Leave predicates or querying Leave tables.
No client should infer security from the projection: route authorization must
continue to execute on the server.

### 6.4 Symbol-level consumer trace

The direct production consumers of the current projection/helper symbols are
distributed as follows:

| Symbol/contract | Direct production definitions and consumers | What crosses the boundary today |
| --- | --- | --- |
| `HybridAuthSession` / `ApiAuthSession` | Defined in `lib/auth/types.ts`; aliased and returned by `lib/auth/server.ts`; consumed by `lib/auth/api.ts`, `app/api/auth/me/route.ts`, `app/page.tsx`, `app/login/page.tsx`, `app/dashboard/layout.tsx`, and `app/dashboard/_lib/route-access.ts` | Broad current-user projection is used for both server gating and presentation. There is no separate direct browser import of `HybridAuthSession`; the browser receives the serialized `/me` shape. |
| `getApiAuthSession()` | `app/api/auth/me/route.ts`, `app/page.tsx`, `app/login/page.tsx`, `app/dashboard/layout.tsx`, `app/dashboard/_lib/route-access.ts`, and the implementation of `lib/auth/api.ts` | One resolver currently supplies API response, page redirects, Dashboard gating, and admin route access. |
| `requireApiSession()` | `lib/auth/workforce.ts`; direct route consumers in `app/api/departments`, `app/api/audit-logs/export`, `app/api/employees` (self-service branch), `app/api/employees/stats`, `app/api/employees/export`, `app/api/email-request` (requester branch), and `app/api/notifications/**` | Generic authentication context is the input to Department, Employee, Email Request, Notification, and Audit composition. Active-workforce wrappers add Employee policy for Leave/Routine/Stock/LINE. |
| `requireAdminSession()` | Direct route consumers in `app/api/audit-logs`, `app/api/email-request`, `app/api/employees/**`, `app/api/uploads/image`, `app/api/leave/approvers`, `app/api/routines/**`, and `app/api/stock/**` | Generic role authorization is used as a prerequisite; each capability still owns operation-specific authorization and transaction rechecks. |
| `UserContext` from `lib/auth/context.ts` | Defined and constructed only through `lib/auth/api.ts`; its `auth.user` value is passed by the route groups above into capability services. The duplicate Audit `UserContext` in the removed `lib/services/audit-log/types.ts` path was removed in L6; the separate `lib/services/email-request/types.ts` definition remains | The narrow context is an application input. The remaining Email Request duplicate and direct `auth.user` plumbing are compatibility debt to consolidate only after J1 seams are proven. |
| `AuthenticatedUser` | `components/auth/HybridAuthProvider.tsx` is the direct typed browser consumer; `AuthStatus`, Dashboard contexts/navigation, and feature components consume the provider's user state | The client receives safe serialized identity plus Department/Leave presentation fields, so those business projections currently appear to be Auth-owned. |

Tests also mock or assert these contracts across the Auth, API, Dashboard,
Leave, workforce, and browser test files listed in section 19. No additional
production consumer of the `HybridAuthSession` type itself was found beyond
the server aliasing/projection path above.

## 7. User/account identity model and ownership

The Prisma `User` model is a shared relational hub, not an Auth-owned person
aggregate. It contains account fields and foreign-key relations for multiple
capabilities. The following is the field-level decision.

| User field/relation | Current meaning | Semantic owner after migration |
| --- | --- | --- |
| `id` | Stable User/account id and foreign-key target | Auth/Account Identity as stable subject; other capabilities may reference it. |
| `email` | Unique login identifier and contact value | Auth owns login identity, normalization, and account uniqueness; consumers own contact use. Employee remains the canonical workforce email source where the Employee lifecycle synchronizes the account. |
| `password` | Bcrypt password hash | Auth credential lifecycle. Never part of a client contract or generic display projection. |
| `role` | `USER`/`ADMIN` generic account role | Auth account authorization; feature modules must not assume role equals their business capability. |
| `tokenVersion` | Invalidation counter checked against access JWT `ver` | Auth/Session invalidation. Employee account lifecycle and password reset coordinate updates through the Auth contract. |
| `isActive` | Account can authenticate/use account | Auth account lifecycle. Employee status is a separate workforce invariant. |
| `deletedAt` | Soft-deleted account state | Auth account lifecycle. Employee `deletedAt` remains Employee-owned. |
| `employeeId` | Optional unique account-to-Employee association | Cross-capability account/workforce association. Auth consumes it for account eligibility/session resolution; Employee owns the Employee record and lifecycle rules; coordinated writes belong to an outer account-lifecycle composition. |
| `name` | Account display snapshot, initially and during lifecycle synchronization derived from Employee | Auth may keep a safe account fallback, but Employee owns canonical workforce identity and the synchronization policy is composition-owned. |
| `createdAt`, `updatedAt` | Persistence metadata | Account persistence metadata; no independent business rule is assigned in J0. |
| `refreshTokens` | Relation to `AuthRefreshToken` | Auth/Session. |
| `employee` | Relation to Employee | Employee/workforce relationship; Auth receives a narrow status/identity contract. |
| `lineAccountLink` | Optional external LINE identity link | LINE/LIFF account-link boundary. |
| `auditLogs` | Audit records associated with a User | Audit capability. |
| `emailRequests` | Email Request requester relation | Email Request/future IT capability. |
| `notifications` | In-app Notification recipient relation | Notification capability. |
| Leave, Stock, Routine, and other relations | Feature-owned business references to a User | The owning capability; not Auth-owned merely because the relation points to User. |

Auth therefore owns a field-level account slice, not the entire User model or
all User relations. No J0 schema change is proposed.

## 8. Authorization discovery and classification

Authentication proves or resolves the account/session. Authorization is split
by the rule that determines the decision:

| Mechanism | Evidence | Classification and owner |
| --- | --- | --- |
| JWT signature/claims, active family, User active/deleted, token version | `lib/auth/hybrid/tokens.ts`, `session-store.ts`, `server.ts`, `hybrid/route.ts` | Authentication/session validity; Auth/Session. |
| `isAdminRole`, `requireAdminSession` | `lib/ssot/permissions.ts`, `lib/auth/api.ts` | Generic account authorization; Auth owns the primitive, feature routes own where it is appropriate. |
| User-id ownership checks | Leave, Stock, Routine, Email Request, Notification application/routes | Business/application authorization; owning capability. Auth supplies the stable actor id. |
| `hasEligibleEmployeeLifecycle` | Employee public domain contract consumed by login/signup/current session | Employee/workforce eligibility; Employee owns the predicate. Auth composes it for login/session entry. |
| `requireActiveWorkforceSession` and transaction variants | `lib/auth/workforce.ts`, `workforce-transaction.ts`, feature transaction guards | Application/workforce composition. It is not a generic role check and must retain Employee state rechecks and lock ordering. |
| Dashboard menu/route visibility | `DashboardProvider`, menu constants, `requireDashboardAdmin` | Dashboard/application presentation composition. Hidden UI is not security. |
| Leave actionable approval/history predicates | `modules/leave`, current `lib/auth/server.ts` and `lib/auth/liff.ts` | Leave business-capability authorization; Leave owns the rules. |
| Routine task/occurrence ownership and admin mode | `modules/routine/application/authorization.ts` and route/application code | Routine business authorization; Routine owns the transaction recheck and scope. |
| Stock requester/issuer/admin policy | Stock routes and `modules/stock` application/infrastructure | Stock business authorization; Stock owns its distinct admin policies. |
| Notification user scope | Notification routes/application | Notification capability authorization. |
| Email Request admin/all-vs-own query | `lib/services/email-request/queries.ts`, route | Email Request capability/application authorization. |
| Audit log admin access | `app/api/audit-logs/**` plus `requireAdminSession` | Audit delivery policy composed from generic account role; Audit owns audit data/query semantics. |
| LIFF feature capabilities | `lib/auth/liff.ts` and `/api/line/home` | Application/feature composition. The current helper mixes generic role, feature flags, and Leave capability; it is not generic Auth ownership. |
| LINE account-link eligibility | `/api/line/account-link` plus active workforce helper | LINE/LIFF integration plus Employee/workforce precondition. |

The migration must not turn `requireAdminSession` into a central repository for
Leave, Stock, Routine, or Dashboard permissions.

## 9. Employee/workforce boundary

The Employee F0-F3 migration record is authoritative. Employee owns:

- Employee profile and canonical display identity;
- organization email stored on the Employee record;
- Employee status and `deletedAt`;
- Department association and Employee-specific Department mapping/display;
- `managerId`, hierarchy, and Employee-owned lifecycle rules;
- Employee API/application/persistence and its public contracts.

Auth owns or coordinates:

- User credentials, login, role, account `isActive`/`deletedAt`;
- access-token and refresh-session invalidation;
- account activation/deactivation synchronization;
- signup User creation and password hashing;
- web authentication and generic account authorization.

The outer application/account-lifecycle composition owns the operation that must
coordinate both records. It must preserve the existing serializable
transaction, Employee/User lock ordering, last-active-admin protection,
self-offboarding protection, identity synchronization, token-version change,
and refresh-family revocation.

Auth legitimately requires these narrow Employee contracts:

- `hasEligibleEmployeeLifecycle(employee)` for the current login/session
  decision;
- `findSignupEmployee(email)` for the preflight signup lookup;
- `lockAndRecheckSignupEmployee(tx, employeeId, expectedEmail)` for the
  transaction-aware signup eligibility recheck;
- Employee display/name contracts needed for the existing signup and display
  response.

Auth must not import Employee persistence internals or absorb Employee status,
hierarchy, Department association, or Leave offboarding policy. The current
`lib/auth/employee-account-lifecycle.ts` is a semantic account/session helper
used by Employee lifecycle code, but its physical placement under `lib/auth`
and direct transaction access are a boundary leak. J1 must replace that with a
narrow Auth account-lifecycle contract while preserving the same transaction
client and invariants.

The existing signup decision remains authoritative: signup is Auth-owned while
Employee supplies eligibility, exact-email lookup, and lock/recheck contracts.

## 10. Signup and credential lifecycle

The current signup path is:

```text
trusted mutation
    -> signupSchema: organization email, password, confirmation
    -> Auth rate limit: 5 per identity / 25 per IP per hour
    -> preflight User email lookup
    -> Employee public exact-email lookup
    -> eligible Employee and no linked User check
    -> bcrypt.hash(password, 12)
    -> serializable transaction with up to four P2034 retries
         lock Employee row
         reload exact email and status/deletedAt
         reject a newly linked account or changed/ineligible Employee
         create User with Employee name/email, active=true, employeeId
         assign ADMIN only for configured bootstrap email; otherwise USER
    -> clear identity rate-limit entry
    -> best-effort USER_CREATE Audit
    -> 201 response
    -> browser POST /api/auth/hybrid-login
```

The database unique constraints remain the final duplicate/race protection;
`P2002` is mapped to the existing 409 account-registered response. Signup does
not issue a session server-side. The client immediately starts the existing
login flow after a 201 response.

The exact input and wording are part of the compatibility ledger: organization
email must end in `@thainhf.org`, signup password minimum is six characters,
confirmation must match, and the existing Thai validation/error messages stay
unchanged. Reset-password has a separate stronger minimum-eight,
lowercase/uppercase/digit policy.

## 11. Password recovery

### 11.1 Forgot-password request

`POST /api/auth/forgot-password` is intentionally public and currently does
not use `withTrustedMutation`. It validates the request, normalizes the email,
applies the one-hour Auth in-memory limit of three attempts per identity and 30
per IP, and checks a database count of recent reset rows for the email. Missing,
unknown, or inactive accounts receive the same accepted anti-enumeration
wording.

For an eligible known account, the route deletes existing unused rows for the
email, generates 32 random bytes, stores only the SHA-256 hex digest in
`PasswordResetToken`, sets a one-hour expiry, and builds the public reset URL.
It calls `sendEmail` with the existing Thai template and escaped URL/name. The
Email transport returns a boolean and logs sanitized technical failures; the
current forgot route returns its accepted response even when delivery is not a
successful business outcome. This is recorded, not changed.

There is no production forgot-password Audit producer today.

### 11.2 Reset-password command

`POST /api/auth/reset-password` is also public and currently does not use the
trusted mutation wrapper. It hashes the supplied token, finds a unique unused
and unexpired row, validates the new password, and then runs a serializable
transaction:

1. atomically claim the row with `used=false` and `expiresAt > now`;
2. update the User password hash with bcrypt cost 12 and increment
   `tokenVersion`;
3. revoke all currently active refresh rows for that User.

If the claim count is not one, the operation fails without changing the
password or sessions. P2034 retries re-evaluate time and the claim predicate.
After a successful transaction, best-effort `PASSWORD_RESET` is emitted and
the web cookies are cleared. The reset token is one-time use and expires after
one hour. No separate cleanup route for old PasswordResetToken rows was found;
the next forgot request deletes unused rows for that email.

Auth owns token creation, hashing, claiming, password change, and session
invalidation. Email/platform owns SMTP transport and the generic delivery
adapter; the password-reset use-case-specific template remains a delivery
artifact and is not an argument for moving SMTP into Auth.

## 12. Persistence ownership and Prisma inventory

### 12.1 Schema constraints relevant to the boundary

`prisma/schema.prisma` establishes:

- `User.email` unique;
- optional `User.employeeId` unique, with the Employee relation;
- `User.refreshTokens` cascading to `AuthRefreshToken`;
- `User.lineAccountLink` one-to-one;
- `AuthRefreshToken.tokenHash` unique;
- `AuthRefreshToken.rotatedFromId` nullable but unique;
- AuthRefreshToken indexes on User, family, expiry, and revocation;
- `PasswordResetToken.token` unique, with email and expiry indexes, but no
  direct User foreign key;
- `LineAccountLink.userId` unique and `lineUserId` unique, with cascading User
  deletion.

No schema, enum, index, relation, or storage compatibility change is part of
J0.

### 12.2 Production persistence ledger

The ledger below covers the relevant direct production Prisma delegate calls.
Tests, fixtures, seed/migration/schema support, and generated Prisma code are
not production ownership entries. A User read by a feature is not thereby an
Auth-owned write or a transfer of the whole User model.

| Production path and function/use case | Delegate and operation | Current semantic owner | Invariant/transaction semantics | Target owner / J phase |
| --- | --- | --- | --- | --- |
| `app/api/auth/hybrid-login/route.ts::POST` | `prisma.user.findUnique` read; `prisma.authRefreshToken.create` write | Legacy Auth route | Credentials, active account, Employee eligibility; create is outside a DB transaction with JWT signing/Audit | Auth/Session server + Auth-owned account slice, J1 |
| `app/api/auth/refresh/route.ts::POST` | `authRefreshToken.findUnique`, family `updateMany`, transaction `updateMany` old/create successor, transaction successor `findFirst` | Legacy Auth/Session | Hash lookup, family revocation, conditional claim, unique `rotatedFromId`, concurrent refresh race | Auth/Session persistence, J1 |
| `app/api/auth/logout/route.ts` | `authRefreshToken.findUnique`, `update` | Legacy Auth/Session | Only current refresh row is revoked; Audit follows | Auth/Session, J1 |
| `app/api/auth/logout-all/route.ts` | `user.findUnique`, `authRefreshToken.updateMany` | Legacy Auth/Session | Authenticated User; all active families revoked | Auth/Session, J1 |
| `app/api/auth/sessions/route.ts` | `authRefreshToken.findMany` | Legacy Auth/Session | Only active/unexpired rows for resolved User; current family marker | Auth/Session session-query use case, J1 |
| `app/api/auth/sessions/revoke/route.ts` | `authRefreshToken.findFirst`, family `updateMany` | Legacy Auth/Session | Ownership, expiry, family-wide revoke, current-cookie clearing | Auth/Session, J1 |
| `app/api/auth/cleanup/route.ts` | `authRefreshToken.deleteMany` | Legacy Auth maintenance | Seven-day retention for revoked/expired rows; secret header | Auth/Session retention/cleanup, J1; scheduling remains external |
| `app/api/auth/forgot-password/route.ts` | `passwordResetToken.count`, `deleteMany`, `create`; `user.findUnique` | Legacy Auth recovery | Rate limit, anti-enumeration, one active unused token per email by replacement, one-hour expiry | Auth credential recovery, J1 |
| `app/api/auth/reset-password/route.ts` | `passwordResetToken.findUnique`, `user.findUnique`; transaction token `updateMany`, User `update`, refresh `updateMany` | Legacy Auth recovery | Atomic one-time claim, bcrypt hash, token-version increment, all-session invalidation | Auth credential/session persistence, J1 |
| `app/api/auth/signup/route.ts` | `user.findUnique`; transaction `user.create` | Auth use case + Employee eligibility | Serializable transaction and Employee row lock/recheck; unique-race mapping | Auth account creation with Employee public contract, J1 |
| `lib/auth/hybrid/session-store.ts::hasActiveSessionFamily` | `prisma.authRefreshToken.findFirst` | Legacy Auth/Session | Active/unexpired family row | Auth/Session repository, J1 |
| `lib/auth/hybrid/route.ts::resolveAuthenticatedUserId` | `prisma.authRefreshToken.findUnique`; `prisma.user.findUnique` | Legacy route Auth helper | JWT, active family, User state, token version, optional Employee active state | Auth/Session principal resolver; workforce composition remains separate, J1 |
| `lib/auth/server.ts::findActiveUser` | `prisma.user.findUnique` with Employee/Department/Leave relations | Legacy Auth current-user projection | Active/non-deleted User; broad Employee/Department/Leave projection | Auth account identity + app/Employee/Leave composition, J1/J2 |
| `lib/auth/server.ts::hasLeaveApprovalReportHistory` | `prisma.leaveRequest.findFirst` | Legacy Auth projection | Leave history predicate | Leave capability + app composition, J2; remove direct generic Auth dependency |
| `lib/auth/workforce.ts` | `prisma.user.findUnique` with Employee status | Legacy Auth workforce helper | User and Employee active checks; admin bypass only in explicit helper | Auth principal + Employee/workforce contract, J1 |
| `lib/auth/workforce-transaction.ts` | transaction User `findUnique`/`findFirst` plus row-lock helpers | Legacy Auth/workforce helper consumed by Stock | Locks and rechecks User/Employee active state in caller transaction | Narrow workforce contract/outer composition, J1 |
| `lib/auth/employee-account-lifecycle.ts` | transaction User `findMany`/`update`; AuthRefreshToken `updateMany` | Account lifecycle semantics; physically `lib/auth` | Same Employee serializable transaction, last-admin/self protection, account state + token/session invalidation | Auth account-lifecycle port bound by Employee/application composition, J1 |
| `lib/auth/liff.ts::findActiveLiffWorkforceIdentity` | `prisma.user.findUnique` with Employee | Mixed Auth/LINE/LIFF helper | Active User, active Employee, User/Employee link consistency, optional employee claim match | LINE/LIFF integration consuming Auth + Employee contracts, J3 |
| `lib/auth/liff.ts::getLiffCapabilities` | `prisma.leaveRequest.findFirst` | Mixed Auth/LIFF helper | Leave actionable approver query plus feature flags | Leave/app/LIFF composition, J3; not generic Auth |
| `lib/line/account-link.ts` | `lineAccountLink.findUnique` by User/LINE, `create` | LINE account-link persistence | One-to-one uniqueness; idempotent exact link; race reread after P2002 | LINE/LIFF account-link boundary, J3 |
| `lib/line/app-notification.ts::sendAppLineNotification` | User `findUnique` including Employee and LineAccountLink | LINE provider/application adapter | Active User/Employee eligibility; unlinked/ineligible is skipped; provider send is separate | LINE delivery/account-link adapter; J3 seam, not core Auth |
| `modules/employee/application/mutations.ts::prepareEmployeeUpdate` | transaction User `findUnique` for email uniqueness; Employee relation includes User account | Employee lifecycle/application | Employee/User email uniqueness and synchronized identity in same transaction | Employee owns Employee rule; Auth account contract for User identity update, J1 composition |
| `modules/leave/application/queries/active-employee-session.ts` | transaction User `findFirst` after Employee lock | Leave operation | User/Employee active and linked check in Leave transaction | Leave consumes workforce contract or keeps an explicit transaction port, J1/J2 |
| `modules/leave/application/queries/get-employee-id.ts` | `prisma.user.findUnique` | Leave query adapter | Resolve account id to Employee id | Employee/workforce public identity contract, J1/J2 |
| `modules/routine/application/authorization.ts` | transaction User `findUnique` after user lock | Routine transaction authorization | Active account and Employee checks; lock ordering; role/mode policy | Routine-owned authorization with Auth/workforce input, J1 seam |
| `modules/routine/application/queries.ts::resolveActorEmployeeId` | `prisma.user.findUnique` | Routine query | Resolve actor account to Employee scope | Routine + Employee/workforce contract, J1/J2 |
| `modules/routine/application/recipients.ts` | transaction User `findMany`; transaction `lineAccountLink.findMany` | Routine notification recipient policy | Active admin/assignee recipient resolution and linked LINE filtering | Routine owns recipient meaning; LINE account-link public read seam, J3 |
| `modules/routine/application/reminders.ts` | transaction User `findUnique` including Employee/LineAccountLink | Routine reminder dispatch | Revalidate active recipient, assignment, current task/rule, and linked LINE state in transaction | Routine + LINE delivery/account-link seam, J3 |
| `modules/routine/application/scheduler.ts` | `prisma.user.findMany` active admins | Routine scheduler | Admin recipient set for Routine reminders | Routine owns scheduler recipient policy; generic account directory seam may be introduced in J1/J3 |
| `modules/stock/infrastructure/notifications/notifications.ts` | transaction User `findMany` for active admins and cancellation admins | Stock notification producer | Stock-specific active/non-deleted and legacy role policies remain distinct | Stock owns event/recipient policy; Auth supplies account role/status contract if needed, J1/J3 |
| `lib/services/email-request/notifications.ts` | `prisma.user.findMany` by configured email and active state | Deferred Email Request/IT capability | Configured in-app recipient lookup | Email Request/future IT; no Auth ownership transfer, outside J1-J3 unless separately approved |

The authoritative physical owner decisions are:

1. `AuthRefreshToken` is exclusively Auth/Session-owned in the target. Family
   lifecycle, rotation, reuse detection, revocation, retention, cleanup, and
   all Auth refresh persistence must be behind the Auth server/application/
   infrastructure contract in J1.
2. `PasswordResetToken` is Auth credential-recovery persistence in the same
   target boundary.
3. `LineAccountLink` is not generic web-session persistence. It is owned by
   the LINE/LIFF identity/account-link integration seam and exposed through a
   narrow contract in J3.
4. `User` is physically shared, but its account field slice has the Auth owner
   defined in section 7. Feature-specific User reads and relations do not
   become Auth-owned merely because they use the User delegate.

## 13. LINE / LIFF identity boundary

### 13.1 Current behavior

`lib/line/verify-id-token.ts` sends the supplied LINE ID token to LINE's
verification endpoint with the configured login channel id. It validates a
non-empty `sub`, exact audience, future integer expiry, and accepted issuer,
then returns only `{ lineUserId }`. The ID token itself is not persisted.

`lib/line/account-link.ts` supports exact-link idempotency and rejects a LINE
identity already owned by another NHF User or an NHF User already linked to a
different LINE identity. Database uniqueness is the final race protection;
after a P2002 it rereads both unique keys and returns idempotent only when both
now describe the exact requested link.

`POST /api/line/account-link`:

1. applies the request-size guard and trusted mutation check;
2. requires an active web workforce session;
3. verifies the LINE ID token;
4. links the verified LINE subject to the authenticated User;
5. issues a LIFF session containing User id and Employee id; and
6. returns the existing linked workforce response.

`POST /api/line/liff/session`:

1. applies the request-size and trusted-mutation checks;
2. verifies the LINE ID token;
3. finds the NHF User by `lineUserId`;
4. returns `{ linked: false }` and clears the LIFF cookie when no link exists;
5. rejects an inactive/deleted User or Employee with 403 and clears the cookie;
6. issues a LIFF session for a valid linked workforce identity.

The LIFF session in `lib/line/liff-session.ts` is a separate HS256 JWT with
purpose `nhf-liff`, issuer `nhf_employee`, audience `nhf-liff`, User id as
subject, Employee id, `iat`, and `exp`. Default lifetime is one hour and the
configured maximum is 24 hours. It is stored in HttpOnly cookie
`nhf_liff_session`, SameSite=Lax, root path, Secure only in production.

LIFF session bootstrap/recovery follows this sequence:

```text
LINE ID token
    -> LineAccountLink lookup
    -> active User/Employee validation
    -> issue LIFF session
```

`POST /api/line/liff/session` performs the `LineAccountLink` lookup, then
`findActiveLiffWorkforceIdentity()` validates User existence, `User.isActive`,
`User.deletedAt`, linked Employee existence, Employee status, Employee
`deletedAt`, and User.employeeId-to-Employee.id consistency before issuing the
LIFF session.

Subsequent LIFF API authorization follows a different sequence:

```text
LIFF session cookie
    -> verify LIFF JWT
    -> revalidate User + Employee + employeeId consistency
    -> authorize the request
```

`requireLiffWorkforceSession()` calls `findActiveLiffWorkforceIdentity()` with
the User and Employee ids from the verified LIFF claims. The helper rechecks
the User and Employee conditions above and confirms that the session
Employee id still matches the current Employee id. It does **not** query or
revalidate `LineAccountLink`. Therefore normal LIFF feature routes do not
reread `LineAccountLink` after a valid LIFF session has been issued. The
Employee claim is not trusted by itself, but the absence of per-request link
revalidation is a current compatibility/security characteristic and must not
be changed implicitly by J3.

`LiffBootstrap` uses `@line/liff` to initialize/login and obtain a fresh ID
token. It does not use the web hybrid refresh token. On a LIFF 401, safe GET/
HEAD requests may be replayed after a single-flight session re-establishment;
mutations are deliberately not replayed and instead show a recovered-session
message. Unlinked, inactive, malformed, expired, and provider-error states
have existing Thai UI/error behavior that must remain compatible.

### 13.2 Boundary decision

These responsibilities are related but are not all one Auth capability:

| Responsibility | Target boundary | Reason |
| --- | --- | --- |
| LINE ID-token verification | LINE/LIFF identity adapter | External-provider trust, audience/issuer/expiry rules, and provider error mapping. |
| NHF User ↔ LINE identity link | LINE/LIFF account-link persistence/use case | Provider-specific one-to-one identity association and conflict/idempotency rules; it is not a web refresh family. |
| LIFF workforce session bootstrap/validation | LINE/LIFF integration/application seam consuming Auth + Employee | Separate cookie/purpose/TTL and LINE-driven recovery; it composes stable NHF identity with workforce eligibility. |
| Generic LINE Messaging API transport and webhook signature verification | Shared/platform LINE provider infrastructure | Channel access tokens, provider retries, webhook transport, and Flex message delivery are not authentication. |
| Feature-specific LINE messages and recipients | Leave, Stock, Routine, or future capability | The producer owns event meaning, recipient policy, and stale/dedupe decisions. |

The target therefore keeps LINE/LIFF identity/account linking as a separate
integration boundary with a public seam to Auth/Employee. It must not be
conflated with either `AuthRefreshToken` or generic LINE Messaging transport.
The existing no-unnecessary-ID-token-persistence rule remains explicit.

## 14. Security and platform dependencies

| Current artifact | Current responsibility | Target semantic owner |
| --- | --- | --- |
| `lib/network/trusted-client-ip.ts` | Accepts only a valid `cf-connecting-ip`; does not trust arbitrary `X-Forwarded-For` | Shared trusted-network/platform infrastructure. |
| `lib/auth/csrf.ts` | Trusted origin plus exact XHR header wrapper | Shared security/mutation infrastructure; Auth routes consume it. The current path is compatibility debt, not evidence that Auth owns generic CSRF. |
| `lib/security/mutation-rate-limit.ts` | Process-local pre-auth IP and authenticated mutation quotas, fixed windows, cleanup, Thai 429 response | Shared security/platform mechanism with Auth/feature policies. |
| `lib/auth/rate-limit.ts` | Process-local Auth identity/IP attempt maps and Auth-specific policies | Auth policy at the Auth boundary, using a platform limiter mechanism; distributed semantics are not introduced in J0. |
| `lib/auth/hybrid/tokens.ts` | Auth JWT/opaque token semantics, claims, hashing, TTL, rotation draft | Auth/Session, with `jose` and Node crypto as dependencies. |
| `lib/auth/hybrid/session.ts` | Next cookie adapter, metadata extraction, cookie flags, parsing | Auth/Session cookie contract plus shared HTTP adapter; raw cookie access remains server-only. |
| `lib/db/prisma.ts` | Prisma singleton | Shared database infrastructure. |
| `lib/db/transaction.ts`, `row-locks.ts` | Serializable retries and parameterized User/Employee row locks | Shared database/concurrency infrastructure; Auth and Employee use it. |
| `lib/auth/return-path.ts` | Safe internal redirect validation | Shared HTTP/redirect security primitive, with Auth and LINE presentation consumers. |
| `lib/auth/mutation-headers.ts` | Browser mutation header constant | Shared HTTP contract; existing compatibility import may remain during migration. |
| `jose`, `bcryptjs`, Node `crypto` | Signing/verification, password hashing, random/hash primitives | Platform libraries consumed by Auth; no replacement or version change in J0. |
| Environment configuration | Auth/LINE secrets, TTLs, cleanup secret, public origin, SMTP credentials | Secret/configuration platform; Auth validates its required values but does not expose them to clients. |
| `lib/network/public-url.ts` | Trusted public URL construction for reset links and redirects | Shared request/URL infrastructure. |
| `lib/email/transport.ts` and `lib/email/index.ts` | SMTP transport, safe error logging, retries, generic send result | Email/platform infrastructure. Auth owns recovery use-case invocation and token semantics. |
| `lib/email/templates/password-reset.ts` | Password-reset delivery representation and escaping | Email delivery presentation; Auth supplies the reset URL/name. |
| `lib/server/request-body.ts`, LINE request guards | Request-size protection | Shared HTTP/platform or LINE integration boundary. |
| `console.error` and request metadata | Operational diagnostics and actor/request context | Platform logging; Auth/Audit producers decide meaningful metadata. |

`middleware.ts` is a delivery redirect optimization. It verifies only the access
JWT shape/signature and refresh-cookie presence for page routing. API and server
route helpers remain authoritative for account, family, Employee, and token
version validity.

## 15. Production consumer inventory

### 15.1 Auth routes and server/page consumers

The direct Auth routes are the eleven paths in section 4.2. The active page and
delivery consumers are:

- `middleware.ts` for public/protected redirect and refresh-bridge routing;
- `app/auth/refresh/page.tsx` and `components/auth/RefreshSessionBridge.tsx`
  for refresh-then-return behavior;
- `app/page.tsx` for home redirect;
- `app/login/page.tsx` for server-side authenticated redirect and safe
  `returnTo` handling;
- `app/dashboard/layout.tsx` for server session gating and initial User
  projection;
- `app/dashboard/_lib/route-access.ts` for Dashboard admin page guards;
- Dashboard admin pages for Audit, Email Request, and Employee import/new
  access, which use the route-access helper;
- `app/layout.tsx` for the global `HybridAuthProvider` wrapper.

### 15.2 API capability consumers

The production API graph consumes Auth helpers in these groups:

| API group | Auth contract used | Additional owner/policy |
| --- | --- | --- |
| `app/api/departments` | `requireApiSession` | Department public server capability; route owns response/error composition. |
| `app/api/audit-logs/**` | `requireAdminSession` or `requireApiSession` | Audit public server capability; Audit owns query/persistence. |
| `app/api/employees/**`, `app/api/uploads/image` | Generic session/admin helpers | Employee or upload capability owns operation policy. |
| `app/api/email-request` | Generic session/admin helpers | Deferred Email Request/IT capability owns requester/admin query and mutation policy. |
| `app/api/notifications/**` | `requireApiSession` | Notification public server capability owns user-scoped inbox behavior. |
| `app/api/leave/**` | `requireActiveWorkforceSession`, `requireActiveWorkforceOrAdminSession`, or generic admin | Leave owns leave state, approval, report, attachment, and offboarding policy. |
| `app/api/routines/**` | Active workforce/admin helpers | Routine owns task/occurrence scope and transaction authorization. |
| `app/api/stock/**` | Active workforce/admin helpers | Stock owns requester/issuer/admin policy and transactional rechecks. |
| `app/api/line/account-link` | Active workforce helper | LINE account-link integration consumes web workforce identity. |
| `app/api/line/liff/session` | LINE verification/link plus LIFF identity helper | LINE/LIFF integration; no web session required for a linked LIFF bootstrap. |
| `app/api/line/home`, `app/api/line/leave/**`, `app/api/line/routine/**`, `app/api/line/stock/**` | `requireLiffWorkforceSession` and feature-specific role checks | LIFF composition plus Leave/Routine/Stock business capability. |

All these routes remain server-authoritative. UI visibility, Dashboard menu
availability, and LIFF capability hints do not replace the route checks.

### 15.3 Browser and presentation inventory

| Browser surface | Current behavior and contract | Future presentation owner |
| --- | --- | --- |
| `components/auth/HybridAuthProvider.tsx` | Client SWR `/api/auth/me`, loading/authenticated/unauthenticated state, single sign-out action, 12-minute interval refresh, visibility refresh after ten minutes | Auth client entry in J2; HTTP-only interaction with server contract. |
| `lib/auth/client.ts` and `lib/client/api-client.ts` | Credentials-included fetch; 401 -> single-flight hybrid refresh -> replay; safe reads retry on 429/5xx; all non-GET requests receive XHR header | Auth client transport seam in J2; preserve current replay semantics until explicitly reviewed. |
| Login page/form | Server session redirect, safe return path, hybrid login POST, refreshUser, Thai errors/toasts | Auth presentation in J2; response and redirect contracts unchanged. |
| Signup page/form | Local validation, signup POST, then hybrid login, refreshUser, Dashboard redirect | Auth presentation in J2; Employee eligibility remains server-side. |
| Forgot/reset pages/forms | Public request and reset forms, client password guidance, accepted/Thai errors, reset success redirect | Auth recovery presentation in J2; Email remains infrastructure. |
| `components/auth/AuthStatus.tsx` | Displays current name/department and sign-out state | Auth/Dashboard composition in J2; department is not generic Auth identity. |
| Dashboard layout/context/navbar/sidebar/home | Server initial projection plus client provider; role/menu visibility; name/email/role/department display; Dashboard redirects and sign-out | Dashboard remains shell/composition owner; consumes Auth client and composed identity in J2. |
| Leave Dashboard | Reads `canApproveLeave` and `canViewLeaveReports` to show tabs; server routes still enforce Leave policy | Leave presentation consumes a compatibility composed projection in J2. |
| Stock/Routine/Email/Employee UI | Uses stable User id/role or `useAuth` for browser state and display | Owning capability presentation; Auth exposes only client-safe stable account contracts. |
| Dashboard session-management | `GET /api/auth/sessions`; `POST /api/auth/sessions/revoke`; current session marker; “other devices” calls revoke once per row; current sign-out calls logout | Session presentation may move behind Auth client entry in J2; API semantics remain. |
| `components/liff/LiffBootstrap.tsx`, `lib/client/liff.ts` | LINE SDK bootstrap, link intent, LIFF session recovery, safe GET/HEAD replay, no mutation replay | LINE/LIFF client entry; not the web Auth client entry. |
| `modules/leave`, `modules/routine`, `modules/stock` LIFF presentation | Calls LIFF APIs with current recovery/error semantics and uses `/api/line/home` capability hints | Owning feature presentation, consuming a LINE/LIFF integration contract. |

The client graph must never import Prisma, server-only Auth implementation,
secrets, JWT signing/verifying code, Next server headers/cookies, or session
persistence.

## 16. Business-specific projections and Leave seam

The current Auth-to-Leave dependency is concrete:

- `lib/auth/server.ts` imports `getActionableLeaveApprovalWhere` and
  `getApproverHistoryReportWhere`, includes Leave approval relations while
  loading the current User, and queries Leave history.
- `lib/auth/liff.ts` imports Leave assigned-approver and actionable predicates
  to derive `canApproveLeave` for the LIFF home response.
- Leave Dashboard and LIFF presentation consume those booleans, but the Leave
  routes independently enforce their authorization.

This dependency is a **boundary leak**, not evidence that Auth owns Leave. The
behavior-compatible seam is an explicit Leave capability projection contract:

```text
Auth resolves stable account/workforce identity
    -> app/Dashboard or LINE/LIFF composition asks Leave for capability data
    -> composition returns the existing canApproveLeave/canViewLeaveReports fields
```

The contract may use a transaction/client context where the current Leave
implementation requires it, but it must not expose Leave internals to generic
Auth. `isManager` must similarly come from Employee hierarchy composition.
No J0 code removes or changes these queries.

## 17. Cross-capability dependency matrix

The classification is based on the rule being used, not the directory in which
the current code happens to live.

| Capability | Current interaction/evidence | Classification | Target direction |
| --- | --- | --- | --- |
| Employee | Auth login/signup/current session consume lifecycle eligibility; signup consumes exact lookup and transaction lock/recheck; Employee lifecycle coordinates User account changes and refresh revocation | Legitimate public capability dependency for narrow eligibility; application composition for lifecycle; current `lib/auth/employee-account-lifecycle.ts` placement is boundary leak/compatibility debt | Auth -> Employee public workforce contracts; Employee -> structural account-lifecycle port; outer route/application binds both. |
| Department | Current `/me` projection joins Employee Department name; Department public API is used by Employee import; Dashboard displays the projection | Presentation-only/app composition for Auth; legitimate Employee -> Department public dependency | Auth does not own Department; Dashboard/Employee composition obtains the display projection. |
| Leave | Auth server/LiFF directly import Leave predicates and query Leave; Leave routes consume workforce helpers and own leave rules | Current Auth dependency is boundary leak; route-to-Leave workforce precondition is legitimate application composition | Leave owns capabilities/predicates; Auth exposes principal/workforce prerequisite only. |
| Stock | Stock routes use generic role/workforce helpers; Stock transaction and notifications read User role/status; LIFF capability maps admin role | Legitimate generic account dependency plus feature authorization; some direct User reads are feature-owned, not Auth-owned | Stock owns business policy; Auth supplies stable account/role/workforce contracts. |
| Routine | Routine routes use workforce/admin helpers; Routine transaction authorization rechecks User/Employee; scheduler/recipients read User and LineAccountLink | Legitimate generic/workforce dependency; direct LINE persistence is boundary leak/compatibility debt | Routine owns task/recipient semantics; consume narrow account and LINE-link reads. |
| Notification | Notification routes require generic session; Dashboard navbar mounts Notification client; User relation is Notification-owned | Legitimate public capability dependency and presentation-only composition | Auth supplies user id; Notification owns inbox persistence and user scope. |
| Audit | Auth uses `lib/server/audit` compatibility adapter for login/logout/reset/signup events; adapter already delegates generic writes to `modules/audit` | Legitimate producer dependency with compatibility debt | J3 Auth producer calls `@/modules/audit` directly; Auth retains event meaning/actor/timing. |
| LINE/LIFF | LINE verification, account link, LIFF session, current workforce resolution, feature routes, and Messaging transport are currently split across `lib/line` and `lib/auth/liff` | Separate account-link/identity integration; current mixed `lib/auth/liff` is boundary leak; Messaging is platform | J3 defines a LINE/LIFF identity seam consuming Auth + Employee; Messaging remains provider infrastructure; features retain message meaning. |
| Email | Auth recovery creates token and invokes `sendEmail`; SMTP/template transport is in `lib/email`; Email Request is separate deferred capability | Legitimate platform dependency; Email Request is compatibility/deferred, not Auth | Auth owns recovery use case; Email owns transport/template; no mail redesign. |
| Dashboard/app composition | Dashboard layout/provider/navbar/sidebar use `/me`, role, name, Department, Leave fields, and Auth client; page route guards call broad session helper | Application composition and presentation-only; broad projection is compatibility debt | Dashboard composes identity and business projections; Auth client/server contracts stay narrow. |
| Shared/platform | Trusted IP, origin/CSRF wrapper, rate limits, Prisma, serializable transactions, locks, cookies, public URL, logging, crypto libraries | Platform dependency | Remain under shared/security/db/network/email/platform ownership; Auth consumes policies/primitives. |

No current dependency is classified as an orphan by evidence. The most likely
future cleanup candidates are compatibility adapters and duplicate projections,
not dead code; they require phase-specific proof before removal.

## 18. Audit producer inventory and J3 seam

Phase I3 made `modules/audit/` the authoritative generic Audit capability. Auth
has not migrated its producers. Current Auth-originated producers are:

| Producer | Event and timing | Actor/affected account | Metadata and failure semantics |
| --- | --- | --- | --- |
| `app/api/auth/hybrid-login/route.ts` | `LOGIN_FAILED` after invalid/inactive decision; `LOGIN_SUCCESS` after refresh-row persistence | Failed event uses known User id when available and normalized attempted email; success uses User id/email | `method=hybrid_login`; adapter resolves trusted IP/User-Agent; best effort, Audit failure does not alter 401/200 flow. |
| `app/api/auth/refresh/route.ts` | `LOGIN_FAILED` after family revoke or detected refresh reuse/race/inactive-user attempt | Known User id/email from refresh row | `authFlow=hybrid_refresh`, reason, family id, explicit IP/User-Agent; best effort after security action. Current family-id logging is a sensitive-metadata review item, not changed in J0. |
| `app/api/auth/logout/route.ts` | `LOGOUT` after current refresh row update | User from refresh row | `method=hybrid_logout`; best effort. |
| `app/api/auth/logout-all/route.ts` | `LOGOUT` after all active rows update | Resolved User id/email | `method=hybrid_logout_all`; best effort. |
| `app/api/auth/sessions/revoke/route.ts` | `LOGOUT` after selected family update | Authenticated User id and token-record email | `method=hybrid_logout_single_session`, family id; best effort. |
| `app/api/auth/reset-password/route.ts` | `PASSWORD_RESET` after the atomic token/User/session transaction | Reset User id/email | `method=email_token`, `forceLogoutAllSessions=true`; best effort after the security transaction. |
| `app/api/auth/signup/route.ts` | `USER_CREATE` after serializable User creation | Newly created User is both actor and affected entity | `after` name/email/role plus signup/bootstrap/Employee-name metadata; best effort after transaction. |
| `lib/server/audit.ts::logAuthEvent` | Compatibility dispatcher for the above and the unused `PASSWORD_CHANGE` action type | Maps event to User entity | Catches/logs failures and never breaks the producer. |

No production Auth `PASSWORD_CHANGE` producer and no forgot-password producer
were found. The generic `createAuditLog` adapter also serves Email Request and
other deferred producers; it is not an Auth-owned persistence path.

The J3 producer seam is:

```text
Auth use case chooses AuditAction, actor, entity, details, request metadata,
and strict/best-effort timing
    -> @/modules/audit public append contract
    -> modules/audit infrastructure
```

The Auth producer must not write `AuditLog` directly and must not make generic
Audit interpret login/session semantics. Existing best-effort behavior must be
preserved unless a later phase explicitly proves a strict transaction is
required.

## 19. Test and behavioral-contract inventory

### 19.1 Existing tests

The relevant existing test coverage includes:

- `__tests__/api/hybrid-login-route.test.ts`: valid login, credential failure,
  inactive/deleted/suspended Employee rejection, and currently preserved
  unlinked-User login;
- `__tests__/api/hybrid-auth-routes.test.ts` and
  `__tests__/auth/hybrid-critical-flow.test.ts`: refresh rotation, concurrent
  refresh race, unique successor race, reuse-family revocation, logout, and
  logout-all;
- `__tests__/lib/hybrid-auth-tokens.test.ts` and
  `__tests__/lib/server-auth-token-version.test.ts`: claims, hash-only draft,
  token-version, active family, Employee and Leave projection behavior;
- `__tests__/api/auth-signup-route.test.ts` and
  `__tests__/integration/signup-employee-concurrency.integration.test.ts`:
  validation, bootstrap role, Employee lifecycle/locking, duplicate race, and
  Employee email-update race;
- `__tests__/api/reset-password-route.test.ts` and
  `__tests__/integration/password-reset-concurrency.integration.test.ts`:
  one-time claim, expiry, atomic password/session invalidation, serializable
  retry, and exactly-one concurrent winner;
- `__tests__/auth/workforce.test.ts` and
  `__tests__/auth/workforce-transaction.test.ts`: active/missing/inactive
  Employee, admin bypass, locks, and recheck behavior;
- `__tests__/lib/auth-csrf.test.ts`, `auth-rate-limit.test.ts`,
  `mutation-rate-limit.test.ts`, `auth-return-path.test.ts`, and
  `__tests__/validations/auth.test.ts`: boundary/security primitives and
  validation contracts;
- `__tests__/middleware/hybrid-auth-middleware.test.ts`,
  `__tests__/auth/hybrid-auth-provider.test.tsx`,
  `__tests__/lib/api-client-refresh.test.ts`, and session-management component
  tests: browser refresh, redirect,
  client state, and session UI behavior;
- `__tests__/api/line-auth-routes.test.ts`, `__tests__/auth/liff.test.ts`,
  `__tests__/auth/liff-capabilities.test.ts`,
  `__tests__/lib/line-account-link.test.ts`, `line-id-token.test.ts`,
  `line-liff-session.test.ts`, and LIFF route/client/bootstrap tests: identity
  verification, link conflicts, unlinked/inactive behavior, cookies,
  recovery, and capability presentation;
- feature route and application tests for Leave, Stock, Routine, Notification,
  Employee, Audit, Email Request, and LINE delivery: downstream contracts that
  must not change when Auth helpers are delegated.

No dedicated production `POST /api/auth/cleanup` test was found in the audited
test tree; its secret-header, seven-day predicate, and count response remain
source-level contracts that J1 must cover before moving the route.

The inventory deliberately includes tests that mock the current `lib/auth`
paths. J1/J2/J3 must update test seams only when the implementation boundary
actually moves; tests must not be weakened to make a migration pass.

### 19.2 Minimum regression suite by phase

| Phase | Minimum required regression coverage |
| --- | --- |
| J1 | Hybrid login/tokens/session store; refresh rotation/reuse/race; logout/logout-all/session revoke/cleanup; token-version; signup and both concurrency integrations; reset-password and its concurrency integration; workforce and transaction locks; CSRF/Auth/mutation rate limits; all generic/workforce route authorization tests; Audit timing assertions where Auth routes are touched. |
| J2 | `/api/auth/me` response shape and projection tests; Dashboard server gating and route redirects; `HybridAuthProvider`; API 401 refresh/replay; login/signup/recovery forms; return paths; session-management hook/view; Leave projection visibility; client/server graph architecture checks. |
| J3 | LINE ID-token, account-link, LIFF session, LIFF bootstrap/recovery, home capability, all LIFF Leave/Routine/Stock route/client tests; LINE delivery/outbox tests; Auth Audit producer tests; direct persistence and compatibility-adapter architecture checks; full J1/J2 critical suite. |

## 20. Compatibility and security invariants ledger

The following are migration invariants, not implementation suggestions:

### Authentication and account state

- Missing, invalid, inactive, deleted, or ineligible login attempts preserve
  the current intended indistinguishable credentials response and status.
- The current behavior that a User with no Employee can log in must not be
  changed accidentally; the different `/me`/workforce behavior must be made
  explicit before any later change.
- User `isActive`, User `deletedAt`, Employee status, Employee `deletedAt`, and
  User/Employee linkage remain separate state checks.
- Employee lifecycle eligibility remains Employee-owned.
- Password hashing remains bcrypt with the current cost and no password/hash
  enters a client or Audit payload.
- Bootstrap-admin role assignment, organization email restrictions, duplicate
  mapping, and Thai validation wording remain unchanged.

### Tokens and sessions

- JWT algorithm, secret name, claims (`sub`, `role`, `sid`, `ver`), subject
  format, required-claim checks, and TTLs remain unchanged.
- Access-token verification remains server-side and token-version aware for
  authoritative API/session resolution.
- Raw refresh tokens remain opaque, random, and non-persisted; only SHA-256
  hashes are stored.
- Refresh-family identity, expiry, conditional rotation, unique successor,
  reuse detection, race handling, and family revocation remain unchanged.
- Logout, logout-all, family-wide session revocation, cleanup retention, and
  current-session identification preserve existing semantics, including the
  “single session” UI operation revoking a family.
- `__Host-nhf_at`/`__Host-nhf_rt` names and HttpOnly/Secure/Lax/root-path
  attributes remain unchanged.
- Token-version invalidation on password reset and Employee account lifecycle
  remains atomic with the existing User/refresh writes.

### Signup and recovery

- Serializable signup locking/recheck, Employee email/status revalidation,
  unique-race handling, and User/Employee association remain intact.
- Signup remains a two-step server signup + client hybrid login flow.
- Reset token hashing, one-hour expiry, one-time claim, password update,
  token-version increment, refresh revocation, and concurrency result remain
  intact.
- Forgot-password anti-enumeration, rate limits, public response wording, and
  current Email delivery failure behavior remain intact unless a later phase
  explicitly changes the contract.

### LINE/LIFF

- LINE ID tokens are verified against the configured channel and never stored
  unnecessarily.
- One User maps to at most one LINE identity and one LINE identity maps to at
  most one User; exact duplicate linking remains idempotent and conflicts stay
  409.
- LIFF bootstrap/recovery performs the current `LineAccountLink` lookup and
  preserves the current ID-token error mapping, unlinked response/cookie
  clearing, and inactive/deleted/inconsistent User/Employee response and
  cookie-clearing behavior.
- Invalid or expired LIFF session cookies preserve the current subsequent-route
  response behavior.
- Subsequent LIFF authorization revalidates User existence/account state,
  Employee existence/state, User-to-Employee linkage, and the LIFF
  Employee-id claim against the current Employee id, but does not reread
  `LineAccountLink`. This per-request link-revalidation absence is a current
  compatibility/security characteristic; adding it requires a separate,
  explicit compatibility/security decision and is not implied by J3.
- LIFF session purpose/audience/issuer, claims, TTL, cookie attributes, and
  fresh-ID-token recovery behavior remain unchanged.
- Safe LIFF reads may replay after recovery; mutations must not be replayed
  automatically.

### Contracts, Audit, and presentation

- Existing API URLs, status codes, response shapes, response field absence,
  Thai wording, safe return-path behavior, and API error mapping remain
  compatible.
- Audit actor/entity/details/request metadata and best-effort versus
  transaction timing remain semantically unchanged until J3 migrates the
  producer seam.
- Audit failures remain non-fatal where they are currently best effort.
- Server authorization remains authoritative; UI visibility, middleware page
  redirects, role claims alone, and client fields are not security boundaries.
- Dashboard, login/signup/recovery, session-management, and LIFF presentation
  behavior remains unchanged until the relevant later phase.

## 21. Known risks and compatibility debt

These are recorded risks, not J0 fixes:

1. `getApiAuthSession()` requires a linked eligible Employee, while login and
   `resolveAuthenticatedUserId()` permit a missing Employee. This can produce
   a successful login followed by an unauthenticated `/me`/Dashboard result.
2. Refresh prevalidation checks `User.isActive` but not the full deleted/Employee
   eligibility projection before issuing the next access token. Downstream
   resolution rejects some such tokens; the distinction must be preserved and
   intentionally addressed only with an approved compatibility analysis.
3. Middleware validates JWT signature/claims but not DB family revocation,
   token version, or account state. It is only a page-routing optimization;
   server APIs must remain authoritative.
4. `resolveCurrentSessionFamilyId()` trusts a matching verified access claim for
   the current marker without a separate active-family lookup in that branch.
5. Session UI and route naming imply one session, while revocation is family
   wide. The behavior is tested and is an invariant until deliberately changed.
6. `lib/auth/server.ts` directly queries Department and Leave and computes
   Employee hierarchy/Leave capabilities in a generic projection.
7. `lib/auth/liff.ts` combines web/account identity resolution, LIFF session
   validation, feature flags, and Leave capability logic.
8. `lib/auth/employee-account-lifecycle.ts` is physically under Auth but is
   invoked by Employee lifecycle code and directly persists shared User/
   refresh state.
9. Auth-specific and generic mutation rate limits use process-local Maps. Their
   behavior is not distributed or durable.
10. `RefreshSessionBridge` duplicates a weaker safe-return-path predicate than
    `lib/auth/return-path.ts`.
11. `lib/client/api-client.ts` can retry a non-LIFF mutation after a 401-driven
    refresh by replaying the request. The current behavior is compatibility
    debt and must be reviewed separately from the LIFF no-replay rule.
12. Refresh security Audit metadata currently includes `familyId`, which is a
    sensitive session identifier. J3 should review the minimum useful metadata
    without silently changing the current event contract in J0.
13. Forgot/reset are public flows without the trusted-mutation wrapper. Their
    anti-enumeration and token/rate-limit behavior are current contracts; J0
    does not redesign them.
14. `PasswordResetToken` has no direct User foreign key and no dedicated global
    cleanup path; retention is currently per-email replacement plus expiry
    validation.
15. Duplicate `UserContext`/identity types and compatibility imports exist in
    legacy services. They should be consolidated only after the public seams
    are proven.
16. After LIFF session issuance, `requireLiffWorkforceSession()` revalidates
    User/Employee state and id consistency but does not reread `LineAccountLink`.
    The repository has no normal production unlink/update flow that would
    otherwise define the expected per-request behavior. Any future link
    revalidation decision must be explicit and compatibility/security reviewed;
    J3 does not automatically add it.

## 22. Capability-shape and ownership decisions

### 22.1 One capability or multiple?

The target is **one cohesive Auth / Session / Account Identity server
capability with explicit internal sub-boundaries**, plus a separate
LINE/LIFF identity/account-link integration boundary.

Evidence for keeping the core together:

- credential authentication, User account state, token-version invalidation,
  access-token claims, refresh-family persistence, logout, password recovery,
  and session APIs change together and share the User account invariants;
- `AuthRefreshToken` and password recovery are not independent business
  capabilities in this repository;
- the browser needs one web session contract and one refresh/retry protocol;
- there is no separate person/identity master or independent identity store
  that would justify a standalone generic Identity module;
- Employee is already the canonical workforce identity and has a completed
  boundary, so a second generic “person identity” module would duplicate or
  absorb Employee semantics.

The name “Identity” in this phase means stable NHF account identity and its
safe projection, not a new person master. LINE identity remains a provider-
specific integration boundary because it has distinct trust, persistence,
cookie, and recovery rules.

### 22.2 Auth/Session ownership

The future core boundary owns:

- credential validation, password hashing, signup, and password recovery;
- the Auth-owned User account field slice in section 7;
- access-token issue/verify and token-version semantics;
- refresh-token persistence, family lifecycle, rotation, race/reuse handling,
  revocation, session listing, session revocation, logout, logout-all, and
  cleanup;
- stable authenticated principal and generic account identity contracts;
- generic role-level guard primitives;
- Auth-specific Audit event meaning at the producer side.

It does not own Employee lifecycle policy, Leave capability policy, Department
reference data, feature permissions, Dashboard shell, LINE Messaging
transport, or Email SMTP.

### 22.3 Conceptual future server contract

The names below are conceptual contracts, not J0 code:

```text
resolveAuthenticatedIdentity(request)
    -> null | { userId, sessionFamilyId, tokenVersion }

requireAuthenticatedSession(request, options?)
    -> authenticated principal + current generic account identity
    -> existing unauthorized response on failure

requireAccountRole(request, role, options?)
    -> authenticated principal with a generic account-role decision
    -> existing forbidden response on role failure

getCurrentAccountIdentity(request)
    -> { userId, email, accountDisplayName?, role }
    -> no Employee hierarchy, Department, Leave, Stock, Routine, or LINE capability

requireActiveWorkforceSession(request)
    -> application/workforce composition over Auth principal + Employee public contract
```

The final public types must preserve current route needs, but they must make
stable identity, generic account authorization, workforce eligibility, and
business capability projections distinct concepts.

### 22.4 Business-specific session projections

The existing `/api/auth/me` shape may remain a composed compatibility response.
Its future construction belongs to app/Dashboard or a dedicated composition
use case that calls:

- Auth for stable account identity and generic role;
- Employee/Department for canonical display, Department, and hierarchy;
- Leave for `canApproveLeave` and `canViewLeaveReports`.

The generic Auth module must not contain Leave-specific predicates or query
Leave tables simply because the Dashboard currently receives the fields from
`/api/auth/me`.

### 22.5 Browser-safe boundary

J2 should introduce a dedicated Auth client entry only if the existing active
browser graph is moved into the module. It may expose:

- client-safe identity/session types;
- provider/context and `useAuth`-equivalent state;
- HTTP-based login/signup/recovery/session actions;
- refresh/retry behavior and presentation contracts that do not carry secrets.

It must not expose or transitively import:

- Prisma or any persistence adapter;
- `next/headers`, server cookies, or server-only request objects;
- environment secrets;
- JWT signing/verifying implementation;
- password hashing implementation;
- refresh-token raw values or session persistence;
- Employee/Leave/LINE server internals.

The LIFF client entry remains separate and uses HTTP plus the LINE SDK. It must
not become a path from browser code to web Auth server implementation.

### 22.6 Route ownership

`app/api/auth/**` should remain HTTP delivery. The target route pattern is:

```text
app/api/auth/**
    -> Auth public server contract
    -> Auth application/domain use case
    -> Auth infrastructure/repository
    -> Prisma / platform adapters
```

The route continues to own Next request parsing, body-size/headers where
appropriate, status/response/cookie adaptation, and public redirect delivery.
Auth owns use-case validation, credential/session invariants, and persistence
semantics. Cookie mutation is a legitimate framework adapter at the route or
server boundary; it must not make browser code server-aware.

`app/api/line/**` remains LINE/LIFF delivery and composes the Auth, Employee,
Leave, Routine, and Stock contracts as needed. It is not folded into generic
`app/api/auth/**` by naming convenience.

## 23. Conceptual target dependency flow

```text
Web browser
    -> Auth client entry (J2)
    -> /api/auth/**
    -> Auth server public contract
    -> Auth application/domain
    -> Auth infrastructure
         -> User auth-field slice
         -> AuthRefreshToken
         -> PasswordResetToken
         -> shared db/security/crypto
    -> Employee public eligibility/workforce contract when required
    -> Audit public producer contract in J3

Dashboard/app composition
    -> Auth account identity
    -> Employee/Department display and hierarchy projection
    -> Leave capability projection
    -> existing /api/auth/me-compatible response

LINE/LIFF browser
    -> LINE/LIFF client integration
    -> /api/line/**
    -> LINE identity/account-link boundary
         -> LINE ID verification
         -> LineAccountLink
         -> LIFF session cookie
         -> Auth stable account + Employee workforce contract
    -> Leave/Routine/Stock feature contracts

LINE Messaging / Email / generic rate limiting / trusted network / Prisma
    -> shared/platform boundaries
```

Forbidden target edges include generic Auth -> Leave table/predicate imports,
generic Auth -> Dashboard components, browser -> server Auth/Prisma, Employee
-> Leave runtime imports, and LINE Messaging transport -> Auth session
persistence.

## 24. J1-J3 migration plan

The evidence supports the requested three-slice plan. No alternate split is
needed.

### J1 — Auth / Session Server & Persistence Ownership

Implement only the server/application and persistence seam:

1. establish the Auth public server contract around the current behavior;
2. move or wrap credential authentication, access-token issue/verify, refresh
   family lifecycle, password recovery, session listing/revocation/cleanup,
   logout, and logout-all behind Auth application/infrastructure;
3. make `AuthRefreshToken` and `PasswordResetToken` physical persistence
   exclusive to the Auth boundary;
4. retain current User auth-field writes and User account state semantics;
5. preserve Employee signup lookup/lock/recheck through its public contract;
6. replace the physical `lib/auth/employee-account-lifecycle.ts` seam with a
   narrow transaction-aware account lifecycle contract, preserving Employee's
   transaction, locks, last-admin/self checks, token version, and refresh
   revocation;
7. delegate `app/api/auth/**` routes while preserving every URL, status,
   response, cookie, claim, TTL, Audit timing, and Thai message;
8. leave Dashboard, browser providers, presentation, LINE/LIFF, and Auth Audit
   producer imports otherwise unchanged; and
9. add architecture checks for AuthRefreshToken/PasswordResetToken direct
   persistence and server-only public-entry use only after the moved code is
   proven.

J1 must not “clean up” the projection or fix the known refresh/missing-
Employee differences as incidental refactors. Those are explicit compatibility
decisions for later review.

### J2 — Identity Projection & Presentation Boundary

After J1 server behavior is stable:

1. split the stable Auth principal/account identity from composed Employee,
   Department, and Leave projections;
2. preserve `/api/auth/me` and Dashboard/Leave UI fields through an explicit
   app composition adapter;
3. introduce the browser-safe Auth client entry if the active provider/forms/
   session-management graph is migrated;
4. keep HTTP contracts, automatic web refresh/retry, safe return paths, and
   session-management behavior compatible;
5. enforce that the client graph cannot reach Prisma, secrets, JWT/password
   implementation, or server persistence;
6. keep feature authorization in Leave, Stock, Routine, Notification, Email
   Request, Audit, and Dashboard rather than centralizing it in Auth; and
7. consolidate duplicate identity/context types only where the public contract
   and tests prove the change is behavior-preserving.

J2 does not move LINE/LIFF behavior or migrate Auth Audit producers.

### J3 — LINE/LIFF Integration, Audit Producer Migration & Final Closure

After J1/J2 are stable:

1. define the LINE/LIFF identity/account-link public seam around ID-token
   verification, `LineAccountLink`, LIFF session issue/validation, and fresh
   ID-token recovery;
2. remove generic Auth ownership of Leave capability queries from
   `lib/auth/liff.ts` by composing Leave/app capability contracts while
   preserving `/api/line/home` and LIFF feature behavior;
3. keep generic LINE Messaging transport/provider/webhook infrastructure
   separate from identity/session ownership;
4. migrate Auth `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `PASSWORD_RESET`,
   and `USER_CREATE` producers from `@/lib/server/audit` to
   `@/modules/audit`, preserving event meaning, actor, affected User,
   metadata, timing, and best-effort failure behavior;
5. remove Auth compatibility adapters only after repository-wide producer and
   consumer audit proves they are unused;
6. enforce production persistence exclusivity for AuthRefreshToken,
   PasswordResetToken, and the chosen LineAccountLink seam;
7. add server/client entry and deleted-path guardrails where evidence supports
   them; and
8. perform the final J0-J3 dependency, Prisma, browser, test, Audit, and
   security re-audit without changing schema or production behavior
   speculatively.

## 25. J0 verification record

The documentation-only closure was verified as follows:

- Starting `git status --short --branch` was clean on `main`, at the audited
  baseline commit.
- `npm run architecture:check` could not start because the Windows
  PowerShell execution policy blocked `npm.ps1` before npm ran.
- The equivalent executable invocation, `npm.cmd run architecture:check`,
  passed: `Architecture check passed: checked 959 repository source file(s)
  for module boundaries.`
- `git diff --check` passed.
- A changed-path audit against the audited I3 baseline found exactly these seven
  files: `CONTEXT.md`, `docs/architecture/audit-migration.md`,
  `docs/architecture/auth-session-identity-migration.md`,
  `docs/architecture/dependency-rules.md`,
  `docs/architecture/modular-monolith.md`,
  `docs/architecture/module-boundaries.md`, and `modules/README.md`. No
  runtime source, Prisma schema/migration, generated file, package manifest,
  or lockfile changed.
- All changed text files are UTF-8 without BOM. Existing edited documentation
  files retain CRLF line endings; the new migration record is UTF-8 without
  BOM with LF line endings. No replacement-character/mojibake marker was
  found.
- No lint, typecheck, test suite, build, server, or database command was run:
  J0 made no runtime change, and those checks are phase-appropriate after J1-
  J3 implementation.

## 26. J0 closure criteria

The following are complete in this record:

- [x] audited baseline and J0 scope recorded;
- [x] current credential, access-token, refresh-family, revocation, cookie,
      and token-version behavior recorded;
- [x] User field/relation ownership separated from whole-model ownership;
- [x] AuthRefreshToken and PasswordResetToken target ownership decided;
- [x] Employee/workforce boundary and narrow Auth dependency contracts decided;
- [x] current-user projection fields and Leave seam audited;
- [x] authorization mechanisms classified by semantic owner;
- [x] signup, password recovery, session UI, and refresh behavior recorded;
- [x] LINE/LIFF identity, link, session, messaging, and provider boundaries
      separated;
- [x] Auth Audit producers and J3 public seam recorded;
- [x] security/platform dependencies separated from Auth business ownership;
- [x] relevant production consumers and direct persistence operations
      inventoried;
- [x] test inventory and minimum J1/J2/J3 regression suites recorded;
- [x] compatibility/security invariants separated from known technical debt;
- [x] J1/J2/J3 implementation sequence defined without starting J1.

J0 implementation scope ends here. Any runtime, schema, route, UI, cookie,
token, LINE/LIFF, or Audit-producer change belongs to an explicitly approved
later phase.

## 27. J1 implementation record

Status: **Phase J1 CLOSED — Auth / Session server and persistence ownership
complete.** J2 and J3 remain **NOT STARTED**.

J1 used the approved baseline
`f60b6b5051c6c309592aab76f3ac82ea83bed4dd` (`docs(architecture): correct J0
LIFF and path audit records`). This phase moved ownership without changing the
documented web Auth behavior, API contracts, cookies, token claims/TTLs,
Prisma schema, browser presentation, LINE/LIFF behavior, or Auth Audit
producer semantics.

### 27.1 Resulting module structure and public server API

The new cohesive server capability is deliberately proportional:

```text
modules/auth/
├── application/
│   ├── authentication.ts
│   ├── employee-account-lifecycle.ts
│   ├── recovery.ts
│   ├── sessions.ts
│   ├── signup.ts
│   └── types.ts
├── domain/
│   └── principal.ts
├── infrastructure/
│   └── persistence/
│       ├── account-repository.ts
│       ├── password-reset-repository.ts
│       └── refresh-token-repository.ts
└── index.ts
```

`@/modules/auth` is the supported production server entry. Its application
contract covers hybrid login, the narrow authenticated principal and legacy
User-id resolver, refresh rotation, current-family resolution, active-family
checks, logout/logout-all, session listing/family revocation, cleanup, signup,
password recovery/reset, and the transaction-aware Employee account-lifecycle
provider. The authenticated principal uses the current User-row role from the
same account-resolution projection; the signed JWT role claim remains unchanged
for token compatibility and is not used as current account authority. The
existing access/refresh token primitives are re-exported only as
the server compatibility seam for their unchanged cryptographic behavior; no
browser/client entry was created.

### 27.2 Persistence ownership

Production physical persistence for `AuthRefreshToken` is now restricted to
`modules/auth/infrastructure/persistence/refresh-token-repository.ts`.
Production physical persistence for `PasswordResetToken` is now restricted to
`modules/auth/infrastructure/persistence/password-reset-repository.ts`.
User account-field persistence used by Auth is in the Auth account repository.
Routes and legacy adapters no longer perform either Auth token delegate
operation directly. Tests, fixtures, schema/migrations, seed/support code,
and generated code remain legitimate exceptions.

The refresh implementation preserves the existing opaque-token/SHA-256/family
algorithm, expiry, `rotatedFromId`, unique successor constraint, conditional
claim/update, transaction boundary, successor detection, concurrent loser
family revocation, User prevalidation, Audit timing at the route composition
boundary, and cookie clearing. Password recovery/reset preserves hashed
one-hour tokens, per-email counting and unused replacement, anti-enumeration,
one-time serializable claim, bcrypt update, `tokenVersion` increment,
refresh-session revocation, concurrency behavior, Thai messages, and Email
timing/failure behavior.

### 27.3 Core route delegation

The hybrid-login, refresh, logout, logout-all, sessions, session-revoke,
cleanup, signup, forgot-password, and reset-password routes now compose the
Auth application through `@/modules/auth`. They retain request parsing,
trusted-mutation and rate-limit wrappers, request metadata, HTTP status/body
mapping, cookie application/clearing, response serialization, and deferred
Auth Audit calls. The route-level contracts and cookie names/options remain
unchanged.

`/api/auth/me` was intentionally not moved into generic Auth. `lib/auth/server.ts`
continues to provide its broad account/Employee/Department/Leave projection and
its current Employee-required eligibility behavior. This is the explicit J2
compatibility exception; no Leave predicate or Department projection was
introduced into `modules/auth`.

### 27.4 Employee account-lifecycle composition

Employee now owns the structural `EmployeeAccountLifecycleProvider` port. The
former `lib/auth/employee-account-lifecycle.ts` implementation was removed;
Auth provides the implementation from
`modules/auth/application/employee-account-lifecycle.ts`. The outer Employee
route imports both public module entries and binds that provider. Employee
does not runtime-import Auth, so no Auth ↔ Employee runtime cycle was added.

The provider receives the existing Employee serializable transaction client.
User row locking, self-deactivation protection, last-active-ADMIN protection,
Thai error wording, `isActive`/`deletedAt`, identity synchronization,
token-version increment, refresh revocation, lifecycle semantics, and
atomicity are preserved in that same transaction. The provider is now required
at every public Employee mutation/use-case boundary that can encounter or
synchronize a linked User; no public overload can omit it and defer failure to
linked-user runtime state.

### 27.5 Compatibility paths intentionally retained

Active compatibility/adaptation paths remain for the broad `/me` projection,
cookie/request adapters, generic Auth API/workforce consumers, token constants
and edge-safe routing concerns, browser presentation, and deferred Audit
composition. `lib/auth/hybrid/tokens.ts` remains a small token primitive seam;
it contains no Auth token persistence, and middleware continues to use its
edge-compatible JWT routing path without a Prisma/password/refresh dependency.
No compatibility path retains direct production `AuthRefreshToken` or
`PasswordResetToken` persistence.

### 27.6 J2 and J3 exclusions

- **J2:** browser/client presentation, `modules/auth/client.ts`,
  `HybridAuthProvider`, AuthStatus, login/signup/recovery/session UI,
  automatic browser refresh, RefreshSessionBridge, and separation of the
  broad `/api/auth/me` projection remain not started.
- **J3:** LINE/LIFF identity/link/session/recovery/messaging behavior remains
  untouched. The post-issuance LIFF route revalidation rule remains unchanged.
- **J3:** Auth Audit producers (`LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`,
  `PASSWORD_RESET`, `USER_CREATE`) remain at their compatibility composition
  boundary and were not migrated to `@/modules/audit`.

### 27.7 Architecture enforcement

`npm.cmd run architecture:check` now checks, in addition to existing module
rules:

- direct production `AuthRefreshToken` and `PasswordResetToken` delegate
  operations, including Prisma/transaction aliases and destructured delegate
  aliases, are confined to Auth persistence infrastructure;
- external Auth consumers use `@/modules/auth`, while Auth internals cannot
  import their own public barrel; and
- production Client Component graphs cannot reach the server-only Auth entry.

The checker retains explicit test, fixture/support, Prisma schema/migration,
seed, and generated-code exceptions and does not impose a blanket repository-
wide ban on `prisma.user` access.

Fixture-based regression tests cover direct and transaction delegate access,
aliased and destructured delegates, deep imports, Auth internal barrel imports,
Client Component reachability, and each intentional persistence/public-entry
allowlist.

### 27.8 Verification record

The following checks were executed after the J1 implementation:

- `npm.cmd run architecture:check` — passed; 969 repository source files
  checked before the review-correction test was added; the final check passed
  with 970 repository source files checked.
- `npm.cmd run lint:strict` — passed with zero warnings.
- `npm.cmd run typecheck` — passed.
- Focused Auth principal and Employee route/lifecycle suites — passed, 3 files
  and 66 tests.
- Focused architecture-checker suite — passed, 1 file and 174 tests.
- `npm.cmd run test:run` — passed, 245 files and 2,017 tests.
- `npm.cmd run test:integration:mysql` — passed against the dedicated MySQL
  `employee_nhf_integration` database after applying the existing migrations,
  10 files and 65 tests.
- `git diff --check` — passed.

No development server or production build was run. No schema or migration file
was changed.

### 27.9 Unchanged compatibility risks and remaining work

J1 intentionally leaves the recorded differences intact: login may accept a
User without an Employee, `resolveAuthenticatedUserId` permits that case,
`getApiAuthSession()` requires an Employee, refresh prevalidation does not
perform the complete `/me` Employee/deleted-state check, and middleware JWT
verification is not authoritative for DB account/session state. The documented
concurrent refresh loser may revoke the winning successor's family. These are
compatibility behaviors, not J1 fixes.

J2 remains responsible for the browser/client and broad identity-projection
boundary. J3 remains responsible for LINE/LIFF integration, Auth Audit
producer migration, and final compatibility cleanup. J1 does not claim full
Auth migration completion.

## 28. J2 implementation record — Identity Projection & Presentation Boundary

Phase J2 is closed against baseline
`c027131344983e701718713246d794944eb02977`.

### 28.1 Final Auth boundaries

The final proportional structure is:

```text
modules/auth/
├── application/
├── domain/
├── infrastructure/
├── presentation/
├── client.ts
└── index.ts
```

`@/modules/auth` remains the server public entry. It now exposes the
DB-authoritative `resolveAuthenticatedAccount()` contract in addition to the
J1 principal/session/use-case contracts. The account contract contains only
account identity, current database role, session family, and token version.
It does not query Department or Leave and does not contain Employee hierarchy
or feature-capability fields.

`@/modules/auth/client` is the explicit browser public entry. It exposes
`HybridAuthProvider`, `useAuth`, `AuthenticatedUser`, Auth presentation
components, `RefreshSessionBridge`, and the browser refresh/logout transport
primitives. It does not re-export the server barrel.

### 28.2 Current-user projection ownership

`app/_lib/auth/current-user.ts` is the delivery/application composition seam
for the broad current-user projection. It resolves the narrow Auth account,
then composes the public Employee current-identity/department/hierarchy
contract and the public Leave capability projection. Employee owns canonical
display name, eligibility, department association, and manager hierarchy.
Leave owns actionable original-approver work, exception-approver work, and
historical report access. `shared/` remains independent of business modules.

`/api/auth/me` still returns exactly the existing `id`, `role`, `email`,
`name`, `department`, `isManager`, `canApproveLeave`, and
`canViewLeaveReports` fields with the existing response and unauthorized
behavior. An otherwise-valid Auth account may resolve without an Employee,
but the broad projection still requires an eligible active Employee; missing,
inactive, suspended, or deleted Employee state remains unauthorized.

### 28.3 Server authorization and SSR

`lib/auth/server.ts` is the legacy API-session compatibility adapter. It first
resolves the generic Auth account and then applies the Employee-owned
`hasEligibleCurrentEmployeeForUser()` contract. Therefore generic
`resolveAuthenticatedAccount()` may accept a valid active User without an
Employee, while `getApiAuthSession()`, `requireApiSession()`, and
`requireAdminSession()` preserve their pre-J2 requirement for an eligible
active, non-deleted Employee until each consumer is explicitly audited and
migrated. The compatibility query checks only Employee eligibility; it does
not pull Department or Leave data. No J2 authorization widening was
introduced. `lib/auth/api.ts` and `lib/auth/context.ts` remain thin response
and numeric-context adapters for their existing route consumers; they no longer
own the broad projection. `lib/auth/workforce.ts` keeps the explicit active
Employee requirement and preserves canonical Employee display names for
workforce routes. Generic admin authorization remains server-side, checks the
current DB role only after the legacy eligible session is established, and
never relies on browser state or the JWT role claim.

A repository-wide production audit found that all current
`getApiAuthSession()`, `requireApiSession()`, and `requireAdminSession()` uses
remain behind this compatibility seam; no consumer was explicitly migrated to
a narrower Auth or workforce contract during J2.

Home, login, dashboard layout, and dashboard admin route access now consume
the composed projection directly. Dashboard SSR redirects and admin gating
remain server-side with no protected-content client flash. DashboardProvider
still owns Dashboard UI state and consumes Auth only for identity/session
state and sign-out.

### 28.4 Browser presentation and refresh behavior

Auth presentation moved from `components/auth/**` to
`modules/auth/presentation/**`; production consumers use only
`@/modules/auth/client`. `components/auth/**`, `lib/auth/client.ts`, and the
unused `lib/auth/types.ts` were removed. The provider retains the same SWR
`/api/auth/me` bootstrap, public and LIFF skips, status values, 12-minute
refresh interval, 10-minute visibility threshold, credential inclusion,
single-flight refresh, one retry after 401, internal refresh/logout/logout-all
recursion guards, sign-out clearing, redirects, and cancellation behavior.

Login, signup, forgot-password, reset-password, AuthStatus, and
RefreshSessionBridge retain their existing wording, validation, loading,
redirect, return-path, accessibility, and styling behavior. No LINE/LIFF
browser behavior was moved into the Auth client entry.

### 28.5 Architecture enforcement and verification

The architecture checker now rejects production client reachability of the
Auth server entry, Auth presentation deep imports, deleted legacy browser
paths, and direct/transitive Auth client graph dependencies on Prisma,
server-only packages (including the repository's actual `bcryptjs` package),
Node built-ins, server Auth infrastructure, or the Auth server index. Auth
presentation deep-import violations direct consumers outside the Auth module to
`@/modules/auth/client`, while server Auth deep imports continue to direct
consumers to `@/modules/auth`. Fixture tests cover rejected Client Component
imports, transitive Prisma/`next/headers`/`bcryptjs`/server-entry reachability,
deep imports (including cross-module presentation consumers), the allowed browser
entry/graph, and the legacy path guard.

Verification completed for J2:

- `npm.cmd run architecture:check` — passed; 977 repository source files
  checked.
- `npm.cmd run lint:strict` — passed with zero warnings.
- `npm.cmd run typecheck` — passed.
- Focused J2 review-correction suites — passed; 9 files and 228 tests covering
  generic account resolution, legacy API/admin compatibility, `/api/auth/me`,
  current-user composition, Auth browser transport/provider, Employee/Leave
  projections, and the architecture checker.
- `npm.cmd run test:run` — passed; 249 files and 2,046 tests.
- `npm.cmd run test:integration:mysql` — passed; migrations were current and
  10 integration files/65 tests passed.
- `git diff --check` — passed.

No development server or production build was run. No schema, cookie, JWT,
refresh algorithm, Audit producer, or LINE/LIFF implementation was changed.

### 28.6 J3 exclusions at J2 closure

J3 was **NOT STARTED at J2 closure**. J2 did not migrate or redesign LineAccountLink,
LINE ID-token verification, LIFF session issuance/verification/recovery,
`lib/auth/liff.ts`, `/api/line/**`, LINE Messaging, or Auth Audit producers.

## 29. J3 implementation record — LINE/LIFF Integration, Auth Audit Producers, and Final Cleanup

Phase J3 is closed against baseline
`a1d8a2bb928629f3a93fb8303d7ef365170715f9`
(`fix(architecture): guide cross-module Auth presentation consumers`). This
record is additive to the historical J0-J2 records above; it does not rewrite
their preserved compatibility behavior.

### 29.1 Final LINE/LIFF boundaries

The first-class LINE integration capability is:

```text
modules/line/
├── application/
│   ├── home.ts
│   ├── liff.ts
│   └── types.ts
├── infrastructure/
│   ├── persistence/account-link.ts
│   ├── session/liff-session.ts
│   └── verification/verify-id-token.ts
├── presentation/
│   ├── LiffBootstrap.tsx
│   ├── client-config.ts
│   ├── http.ts
│   ├── liff-client.ts
│   └── liff-home-client.ts
├── client.ts
└── index.ts
```

`@/modules/line` is the server public entry. It exposes the LIFF workforce
session boundary, workforce resolution, home capability composition, account
link/read contracts, frozen LINE ID-token verification, frozen LIFF session
primitives, and the request parsing primitives used by the LINE auth routes.
`@/modules/line/client` is the browser public entry. It exposes only the LIFF
browser recovery/session transport, browser DTOs, `LiffBootstrap`, and the
LIFF home transport. It does not export or transitively reach the server
entry.

LINE owns account-link identity, `LineAccountLink` persistence, verified LINE
Login identity, LIFF session issuance/verification, workforce-session
composition, bootstrap/recovery integration contracts, and LINE-specific
DTOs. It does not own Auth passwords/web sessions, Employee lifecycle, Leave,
Stock, Routine, Messaging meaning, or notification event semantics. The
feature application shell remains outside the integration module;
`components/liff/LiffAppShell.tsx` is retained because it composes the
application/navigation shell rather than LINE identity, while
`LiffBootstrap` is LINE-owned.

### 29.2 Auth/Employee/Leave composition

Auth now exposes the narrow server lookup
`findAccountIdentityById()` through `@/modules/auth`. It returns only the
current account identity/role, email/display name, and active/deleted state;
it does not require a web session family and does not evaluate Employee or
Leave lifecycle.

Employee exposes `findLiffEmployeeByUserId()` through `@/modules/employee`.
Employee owns existence, `ACTIVE` status, deleted state, User linkage, optional
expected Employee ID validation, and the identity fields required for the
canonical display name. LINE composes Auth and Employee to preserve the
existing `user.id`, `user.role`, `user.email`, `user.name`, and `employeeId`
result.

Leave exposes `getLiffLeaveRelationshipProjection()` through `@/modules/leave`.
Leave keeps the exact LIFF actionable assigned-approver query, including its
status predicates and approver precedence. The deprecated
`getLiffLeaveCapabilities()` / `LiffLeaveCapabilities` helper and type were
removed after a repository-wide production-consumer audit; the canonical
relationship projection remains. Auth no longer owns the LIFF Leave capability
query, and LINE does not duplicate Leave policy. Stock role hints
and feature flags remain presentation hints; feature routes remain
authoritative.

### 29.3 Frozen LIFF and LINE behavior

The LINE ID-token verifier now lives under LINE verification infrastructure and
preserves the existing endpoint, POST form encoding, configured Login Channel
ID, `sub`/`aud`/`exp`, issuer acceptance, empty/invalid/upstream/malformed
response handling, error codes, and route status mapping. The token is never
persisted and is never treated as a web Auth session.

`LineAccountLink` authoritative persistence now lives only in
`modules/line/infrastructure/persistence/account-link.ts`. One-to-one
uniqueness, exact duplicate idempotency, conflict behavior, P2002 race
handling/post-race reread, no reassignment, and no unlink flow are unchanged.
Routine recipient resolution and reminder delivery use the narrow LINE read
contract and pass the existing transaction-bound persistence context; Routine
still owns recipient eligibility and notification meaning. The generic LINE
provider adapter in `lib/line/app-notification.ts` also uses that public read
contract. Messaging transport, channel credentials, delivery/retry behavior,
outbox behavior, and feature message semantics remain in their existing
provider/platform or feature owners under `lib/line` and the producing
capabilities.

LIFF JWT signing/verification remains HS256 with the same subject, claims,
purpose, issuer, audience, timestamps, TTL, validation, and secret behavior.
The `nhf_liff_session` cookie and its HttpOnly/Secure/SameSite/path/max-age
options are unchanged and remain separate from web Auth cookies.

`requireLiffWorkforceSession()` is now owned by `@/modules/line`. It maps
missing/invalid/expired or legacy-unbound cookies to 401, configuration
failure to 500, and an invalid current workforce identity or Employee-ID
mismatch to 403. On every protected request it rereads current User and
Employee state, then rereads the current `LineAccountLink.lineUserId` and
compares it with the identity-bound LIFF claim. A missing or changed link
therefore fails closed with 401. Bootstrap, account linking, and fresh
ID-token recovery also reread the link. This immediate current-link policy is
the L3-selected behavior and is no longer an open stale-link decision.

The browser recovery contract remains separate from web refresh: recovery is
single-flight, bootstraps once with a fresh LINE ID token, replays only GET and
HEAD, never automatically replays mutations, preserves recovered-mutation
messaging/metadata, disables web Auth refresh for LIFF establishment, and
preserves all existing `LiffBootstrap` states, Thai wording, redirects,
provider-query cleanup, safe return-path rules, styling, safe-area, and loading
behavior.

### 29.4 Auth Audit producer migration

The seven Auth producer surfaces now call `appendAuditBestEffort()` directly
from `@/modules/audit`: hybrid login (`LOGIN_FAILED` and `LOGIN_SUCCESS`),
refresh security failure (`LOGIN_FAILED`), current logout (`LOGOUT`),
logout-all (`LOGOUT`), selected session-family revoke (`LOGOUT`), successful
password reset (`PASSWORD_RESET`), and successful signup (`USER_CREATE`).
The routes retain event action/entity/actor/email/details choices, timing after
the relevant Auth persistence result, trusted IP/User-Agent top-level request
metadata, and non-fatal best-effort behavior. Refresh-security and selected
session-revoke details use the truncated `familyCorrelation` representation;
new relevant Audit rows do not persist raw runtime `familyId`. Generic Audit
does not interpret Auth meaning, and historical rows containing `familyId`
remain readable.

`lib/server/audit.ts` remains a thin compatibility adapter for legitimate
non-Auth consumers: Email Request, Employee export, Leave export, and Audit
Log export. Auth routes no longer import it. The deleted
`lib/auth/liff.ts` implementation and the moved `lib/client/liff.ts`,
`lib/client/liff-home.ts`, `components/liff/LiffBootstrap.tsx`,
`lib/line/account-link.ts`, `lib/line/api.ts`, `lib/line/liff-home.ts`,
`lib/line/liff-session.ts`, `lib/line/liff-types.ts`, and
`lib/line/verify-id-token.ts` paths are no longer authoritative and are
guarded against reintroduction. Feature-specific `lib/client/liff-stock.ts`
and retained LINE provider files are compatibility/platform code, not duplicate
LIFF identity ownership.

Stable Auth delivery/composition helpers remain intentionally retained where
they still serve non-LIFF production contracts: `lib/auth/api.ts` and
`lib/auth/workforce.ts` remain route authorization adapters, while
`lib/auth/hybrid/**`, `lib/auth/context.ts`, and `lib/auth/server.ts` remain
web-session delivery primitives and compatibility projections. They are not
the authoritative implementation of LINE/LIFF identity or Auth Audit
production.

### 29.5 Enforcement and completion status

The architecture checker now enforces the LINE server/client public entries,
LINE internal self-barrel protection, browser transitive server/secret/Node
dependency protection, direct/aliased/destructured `LineAccountLink`
persistence ownership, deleted LINE compatibility paths, LINE presentation
remediation through `@/modules/line/client`, and Auth API route direct use of
`@/modules/audit`. Fixture regression coverage covers the required
allowed/rejected cases, including external and cross-module LINE presentation
consumers and server-side LINE deep imports, while all J1/J2 rules remain
active.

Phase J3 is **CLOSED — LINE/LIFF identity integration and Auth Audit producer
migration complete.** The Auth / Session / Identity migration is
**COMPLETE**. This closure does not claim that unrelated repository debt is
gone. The runtime hardening track subsequently closed the generic web mutation
replay, refresh family-race, and current-link reread findings. The remaining
related tradeoffs are process-local Auth rate limits under the supported
single-process topology, the bounded five-second same-client refresh
completion ambiguity, the per-request current-link database dependency, and
the truncated `familyCorrelation` collision residual; new Audit rows do not
persist raw family IDs.

### 29.6 Verification record

The J3 verification record is:

- `npm.cmd run architecture:check` — passed; 982 source files checked.
- `npm.cmd run lint:strict` — passed with zero warnings.
- `npm.cmd run typecheck` — passed.
- `npm.cmd run test:run` — passed; 250 files and 2,074 tests.
- `npm.cmd run test:integration:mysql` — not rerun for this tests/checker/docs-only
  correction; the prior J3 integration record remains valid because no runtime,
  schema, or migration file changed.
- `git diff --check` — passed.

Focused J3 correction coverage also passed. The Auth producer route suites now
assert all eight event scenarios (hybrid-login failure and success, refresh
security failure, current logout, logout-all, selected session-family revoke,
password reset, and signup) with exact action/entity/actor/email/details
contracts, trusted Cloudflare client IP and User-Agent metadata, persistence
ordering, and required no-event cases. The best-effort regression exercises
the real `appendAuditBestEffort()` implementation with failing Audit
persistence and verifies representative Auth success and failure results are
unchanged. The architecture fixture suite also covers the corrected LINE
presentation remediation and preserved LINE server-entry remediation. No
development server or production build was run. No Prisma schema or migration
change was required.
