# Employee migration

Status: Phase F0 — Discovery & Boundary Definition.

Discovery baseline: `1c023304fce881d17d13b47f479cf0ac317b02dc`
(`refactor(leave): complete E3 boundary cleanup`).

This document is the Employee F0 discovery record. It defines ownership,
consumer contracts, and the proposed migration slices. It does not migrate
Employee implementation, change runtime behavior, change API contracts, alter
authentication or authorization, redesign the UI, or change the Prisma schema.
There is intentionally no `modules/employee/` directory yet.

## 1. Executive boundary decisions

| Concern | F0 owner decision | Reason and current evidence |
| --- | --- | --- |
| Employee profile and organizational data | Employee | `Employee` owns names, contact fields, position, affiliation, department relation, email, and employee status. The current CRUD, list, stats, import, and export behavior all operate on these concepts. |
| Employee lifecycle policy | Employee | The lifecycle transition is expressed as `EmployeeStatus` plus `Employee.deletedAt`; deactivation also has Employee-specific guards for self-deactivation, the last admin, subordinates, and pending Leave dependencies. |
| User credentials and authentication | Auth/platform | Password hashing, login, access/refresh tokens, cookies, session families, token versions, CSRF/trusted mutations, and auth rate limits live under `lib/auth/**` and related platform code. They are not Employee behavior. |
| Account-to-workforce eligibility | Existing Auth/Workforce boundary | `lib/auth/workforce.ts` and `workforce-transaction.ts` already combine User and Employee state. F0 does not create a new Workforce module. Employee should expose only Employee-side lifecycle/identity contracts; Auth/Workforce should compose them with User/session state. |
| Employee hierarchy | Employee | `managerId`, the self-relation, subordinate lookup, and the meaning of who reports to whom are organizational structure. Leave may interpret that structure for approval, but does not own the underlying relationship. |
| Leave approval and exception policy | Leave | `approverId`, `exceptionApproverId`, reassignment rules, pending-request guards, current-action resolution, and approval capabilities are Leave rules. They must not be moved into Employee. |
| Department reference data | Transitional separate capability; future organization/reference-data capability | `Department` has its own model and `/api/departments` route, but no independent service or module exists. Employee owns its department association and import mapping, not all Department behavior. |
| Display identity | Split by meaning | Employee owns Employee display projection and pure Employee formatting. The fallback projection from a User to Employee/name/email is an Auth/workforce/platform composition concern and must not make generic client code import the Employee server barrel. |
| CSV import/export | Employee | The business meaning of Employee rows, fields, normalization, status, department mapping, and report columns is Employee-owned. CSV parsing/streaming is a technical adapter and may use shared file/HTTP primitives. |
| Audit, LINE, outbox, email, and session mechanics | Shared/platform or delivery | These systems deliver or record events. Employee supplies Employee event meaning/snapshots and identity data; it must not own the global outbox processor, LINE token/session implementation, or generic audit infrastructure. |

The practical rule for F1 is therefore:

> Employee owns what an Employee is, how Employee organizational data changes,
> and what an Employee lifecycle state means. Auth/Workforce owns whether an
> authenticated account may act as workforce. Leave owns what organizational
> relationships mean in Leave workflows.

## 2. Discovery method and completeness

The repository was searched by path and by concept, including `Employee`,
`employeeId`, `managerId`, `departmentId`, `approver`, lifecycle statuses,
soft-delete fields, import/export/stats/search/create/update/delete/profile,
display-name helpers, Auth/Workforce, LINE/LIFF, audit, outbox, Prisma, and
all three migrated feature modules. The search covered application code,
tests, schema/migrations, configuration constants, and architecture docs.

No unknown ownership bucket remains. Files with mixed responsibility or no
current production consumer are called out explicitly as `COMPATIBILITY /
LEGACY` rather than being silently assigned to Employee.

## 3. Current Employee implementation inventory

### 3.1 Delivery and HTTP inventory

| Current path | Observed responsibility | Current classification | F1/F2 target |
| --- | --- | --- | --- |
| `app/api/employees/route.ts` | Authenticated Employee list (`GET`) and admin Employee create (`POST`) | `EMPLOYEE DELIVERY/HTTP` | Thin route adapter over the Employee server/application API in F1 |
| `app/api/employees/[id]/route.ts` | Admin profile/status update (`PATCH`) and soft-delete/offboard (`DELETE`) | `EMPLOYEE DELIVERY/HTTP` | Thin route adapter in F1 |
| `app/api/employees/stats/route.ts` | Authenticated aggregate Employee counts | `EMPLOYEE DELIVERY/HTTP` | Thin route adapter in F1 |
| `app/api/employees/import/route.ts` | Admin JSON import submission and 1,000-row guard | `EMPLOYEE DELIVERY/HTTP` | Thin route adapter in F1; browser file parsing remains a presentation concern until verified |
| `app/api/employees/export/route.ts` | Authenticated streamed Employee CSV export | `EMPLOYEE DELIVERY/HTTP` | Thin route adapter in F1 over Employee report/export contracts |
| `app/api/departments/route.ts` | Authenticated Department reference-data read | `SHARED / PLATFORM` for delivery, `COMPATIBILITY / LEGACY` for the capability | Remains outside Employee in F0; revisit with a future organization/reference-data migration |
| `lib/ssot/routes.ts` | Canonical Employee dashboard/API route constants, including detail, stats, import, export, and departments | `SHARED / PLATFORM` route SSOT with Employee-specific constants | Keep as compatibility route contract; F1 must preserve values |
| `lib/ssot/exports.ts` | Employee export limit of 2,000 rows and batch size of 250 | `SHARED / PLATFORM` policy registry with Employee-specific entry | Employee-owned export policy should move with the feature in F1, while the registry contract remains stable |

There is no Employee detail `GET /api/employees/[id]` route in the current
inventory. The `[id]` route contains `PATCH` and `DELETE` only.

### 3.2 Dashboard route composition

| Current path | Observed responsibility | Classification | Target slice |
| --- | --- | --- | --- |
| `app/dashboard/employees/page.tsx` | Employee management route composition; Suspense boundary | `EMPLOYEE PRESENTATION` plus Next.js delivery | F2 route composition through `@/modules/employee/client` |
| `app/dashboard/employees/loading.tsx` | Loading UI for Employee management | `EMPLOYEE PRESENTATION` | F2 |
| `app/dashboard/employees/new/page.tsx` | Admin gate and Add Employee route composition | `EMPLOYEE PRESENTATION` plus delivery | F2; preserve `requireDashboardAdmin` behavior |
| `app/dashboard/employees/new/loading.tsx` | Loading UI for Add Employee | `EMPLOYEE PRESENTATION` | F2 |
| `app/dashboard/employees/import/page.tsx` | Admin gate and import route composition | `EMPLOYEE PRESENTATION` plus delivery | F2; preserve `requireDashboardAdmin` behavior |
| `app/dashboard/employees/import/loading.tsx` | Loading UI for import | `EMPLOYEE PRESENTATION` | F2 |
| `app/dashboard/employees/import/ImportEmployeeRouteContent.tsx` | Client import route content, Dashboard navigation, SWR invalidation, and `ImportEmployeeCSV` composition | `EMPLOYEE PRESENTATION` with Dashboard/platform dependency | F2 module presentation; keep Dashboard shell/navigation outside Employee |

The route URLs are canonical App Router paths and are not to be changed by the
migration.

### 3.3 Employee feature components and context

The following files are Employee-specific presentation, even though some are
currently under `components/dashboard/`:

```text
components/dashboard/sections/EmployeeManagementSection.tsx
components/dashboard/sections/AddEmployeeSection.tsx

components/dashboard/context/employee/EmployeeContext.tsx
components/dashboard/context/employee/EmployeeProvider.tsx
components/dashboard/context/employee/types.ts
components/dashboard/context/employee/index.ts
components/dashboard/context/index.ts

components/employee/index.ts
components/employee/EmployeeList.tsx
components/employee/EmployeeTable.tsx
components/employee/EmployeeTablePrimitives.tsx
components/employee/EmployeeMobileCard.tsx
components/employee/EmployeeSearchControls.tsx
components/employee/EmployeeModals.tsx
components/employee/EmployeeStatsCards.tsx
components/employee/EmployeeSkeletons.tsx
components/employee/EditStatusModal.tsx

components/employee/add-employee/AddEmployeeForm.tsx
components/employee/add-employee/useAddEmployee.ts
components/employee/add-employee/index.ts

components/employee/edit-employee/EditEmployeeForm.tsx
components/employee/edit-employee/useEditEmployee.ts
components/employee/edit-employee/index.ts

components/employee/import-csv/ImportEmployeeCSV.tsx
components/employee/import-csv/ImportHeader.tsx
components/employee/import-csv/ProgressSteps.tsx
components/employee/import-csv/UploadStep.tsx
components/employee/import-csv/PreviewStep.tsx
components/employee/import-csv/ResultStep.tsx
components/employee/import-csv/useImportCSV.ts
components/employee/import-csv/types.ts
components/employee/import-csv/index.ts

components/employee/shared/EmployeeFormFields.tsx
components/employee/shared/types.ts
components/employee/shared/index.ts
```

`EmployeeProvider` is a feature application/presentation state provider, not a
generic Dashboard workforce provider. It owns Employee list/stats SWR state,
search/filter/page state, edit-modal state, export state, refresh/revalidation,
and Employee mutation toasts. It should move with Employee in F2. The
Dashboard UI/data contexts used by the provider remain Dashboard/platform
composition dependencies.

`EditStatusModal.tsx` has no production consumer in the current search and is
not part of the active composition. It is retained as a legacy/orphaned
Employee presentation artifact until F2/F3 confirms it can be removed.

### 3.4 Legacy server/service, validation, and helper inventory

```text
lib/services/employee/constants.ts
lib/services/employee/import.ts
lib/services/employee/index.ts
lib/services/employee/mutations.ts
lib/services/employee/queries.ts
lib/services/employee/types.ts

lib/validations/employee.ts
lib/validations/index.ts
lib/helpers/employee-helpers.ts
lib/helpers/csv-helpers.ts
lib/helpers/file-validation.ts

types/employees.ts
types/api.ts
constants/employees.ts
constants/ui.ts
hooks/useCSVImport.ts

constants/audit.ts
constants/dashboard.ts
app/globals.css
lib/ssot/messages.ts
lib/audit-log/contracts.ts
lib/audit-log/display.ts
lib/server/audit.ts
```

Classification and target ownership:

| Area | Current classification | Target decision |
| --- | --- | --- |
| `lib/services/employee/queries.ts` | `EMPLOYEE INFRASTRUCTURE` plus application query behavior | Employee application query contracts backed by Employee infrastructure |
| `lib/services/employee/mutations.ts` | `EMPLOYEE APPLICATION` plus Prisma/transaction implementation | Employee lifecycle/profile application use cases; Auth/session side effects use a platform port |
| `lib/services/employee/import.ts` | `EMPLOYEE APPLICATION` plus persistence | Employee import use case with a technical CSV/persistence adapter |
| `lib/services/employee/types.ts` | Mixed service DTO, actor, persistence-derived type, and result contracts | Split into domain/reference types, application commands/results, and route DTOs; do not create a mega type file |
| `lib/services/employee/constants.ts` | Employee query/import policy | Employee module policy/constants |
| `lib/validations/employee.ts` | Employee route/form schemas | Employee `schemas/` or route-facing presentation schemas in F1 |
| `lib/validations/index.ts` | Legacy re-export of Employee create/update schemas and inferred types | Compatibility facade; remove its Employee exports once all consumers use the module contract |
| `lib/helpers/employee-helpers.ts` | Mixed Employee semantics, identity projection, presentation formatting, and User fallback | Split by ownership; detailed per-export decision appears below |
| `lib/helpers/csv-helpers.ts` | Mixed Employee CSV and Leave CSV implementation; runtime Prisma enum import | Split Employee CSV behavior from Leave CSV behavior during F1/F3; no whole-file move |
| `lib/helpers/file-validation.ts` | Generic file validation with current CSV-specific implementation | Shared/platform primitive if it remains generic; Employee import owns which file policy it applies |
| `types/employees.ts` | Legacy combined domain/API/UI/CSV types | Compatibility facade during F1; split types by layer and remove in F3 after consumer audit |
| `types/api.ts` | Legacy API types; `GetEmployeesResponse` does not match the current paginated response | Compatibility/legacy; do not make it the new module contract |
| `constants/employees.ts` | Employee status values, labels, colors, icons, descriptions | Employee domain/presentation policy; client-safe exports may be exposed through `client.ts` only when there is a real consumer |
| `constants/ui.ts` | Generic UI constants with Employee CSV/status/pagination entries; some entries are stale | Compatibility/legacy; do not move the whole file into Employee |
| `hooks/useCSVImport.ts` | Older duplicate CSV hook with no production consumer found | Compatibility/legacy; verify and remove only in F3 |
| `constants/audit.ts` | Shared audit labels/entity labels for Employee events and `EmployeeApprover` | Audit/platform registry; Employee event meaning remains Employee/Leave respectively |
| `constants/dashboard.ts` | Dashboard menu/tab entries and route composition for Employee screens | Dashboard delivery/platform; keep route visibility separate from authorization |
| `app/globals.css` | Global Employee dashboard/action/nickname design tokens | Shared global styling; keep tokens global unless a later design-system change explicitly scopes them |
| `components/dashboard/context/index.ts` | Legacy Dashboard context barrel re-exporting Employee provider/hooks/types | Compatibility facade; F2 should remove Employee exports after route consumers use the module client boundary |
| `lib/ssot/messages.ts` | Shared HTTP messages including Employee IDs/profile/update/delete messages | Compatibility message SSOT; preserve values during F1 and move only Employee-specific ownership deliberately |
| `lib/audit-log/contracts.ts` | Generic audit details plus Employee/EmployeeApprover detail shapes | Audit platform contract with feature-specific detail variants; do not move generic audit infrastructure into Employee |
| `lib/audit-log/display.ts` | Client-reachable audit formatting, Employee diff/name formatting, and Leave/Routine labels | Audit presentation/platform; must use client-safe structural Employee formatting after F2 |
| `lib/server/audit.ts` | Generic audit writes plus `logEmployeeEvent`/export logging | Shared audit infrastructure; Employee supplies event meaning and snapshots |

### 3.5 Database and schema inventory

`prisma/schema.prisma` currently defines the Employee boundary used by all
consumers:

- `Employee`: `id`, first/last name, optional phone, unique email, position,
  hire date, `status` (`ACTIVE`, `INACTIVE`, `SUSPENDED`), soft-delete
  `deletedAt`, timestamps, `departmentId`, affiliation, nickname, and nullable
  self-referential `managerId`.
- `User`: unique email, role, password, token version, active/deleted state,
  nullable unique `employeeId`, and the Employee relation.
- `Department`: unique name and code, optional description, and the Employee
  relation.
- Leave and Routine records reference Employee IDs for requesters, approvers,
  exception approvers, and assignees.

`prisma/seed.ts` creates the `ADMIN` and `ACADEMIC` departments and bootstrap
Employee data. Historical Employee/Department migrations exist under
`prisma/migrations/`, but F0 introduces no schema or migration change.

### 3.6 Consumer/dependency map

This map records the current runtime direction. “Direct” means an import or
Prisma query is present in the listed consumer; “transitive” means the
consumer reaches Employee behavior through a helper, provider, session
projection, or feature serializer.

| Consumer family | Runtime side | Direct Employee dependency | Transitive dependency | Database/Auth/feature/platform edges | Tests/evidence |
| --- | --- | --- | --- | --- | --- |
| `app/api/employees/**` | Server delivery | Legacy Employee service, schemas, Employee helper, route constants, Prisma/export helpers | Audit event and shared HTTP/CSV response | Employee/User/Department Prisma; API/Admin auth; audit platform | `__tests__/api/employees-routes.test.ts` |
| `app/dashboard/employees/**` | Server route + client content | Employee sections/provider/import content and generic API/SWR adapters | Employee components, forms, helpers, Department endpoint, Dashboard context | Dashboard auth/navigation; Employee API; browser-only state | Employee component tests and dashboard route tests |
| `components/employee/**` and Employee Dashboard context | Client | Employee types/constants/helpers, schemas, CSV/file helpers, API adapters | Provider → list/table/forms/import steps → Employee API | Dashboard UI/data context; no direct Prisma in component tree | `__tests__/components/EmployeeTable*.test.*`, helper/validation tests |
| `lib/auth/**`, `app/api/auth/**` | Server | User queries inspect Employee status/deleted/link/name; signup locks Employee | API session, LIFF identity, hybrid auth, Workforce gate | Auth owns credentials/session; Employee/User/Department DB; Leave public capability API | Auth, signup, hybrid, workforce, LIFF, token-version tests |
| `modules/leave/**` | Server + client | Leave-owned persistence queries select Employee; legacy display helper imports | Requester/approver display, report rows, notification payloads, session capability projection | Leave owns approval/exception rules; Employee supplies identity/status/hierarchy data | Leave unit/API/integration suites and concurrency tests |
| `modules/routine/**` | Server + client | Routine queries/mutations/import/recipients select Employee or linked User data | Assignee display, active/readiness projection, owner mapping, notifications | Routine owns assignee/import/recipient rules; Employee supplies reference data | Routine API/application/integration suites |
| `modules/stock/**` | Server + client | Stock queries/persistence/reports select `User.employee` display fields | Requester/issuer display in notifications, reports, LIFF/UI | Stock owns inventory/request/report rules; Employee supplies identity projection | Stock API/application/integration suites |
| Audit | Shared server + client display | Audit query/display reads Employee names; Employee audit events call shared audit | Generic audit viewer reaches Employee display helper | Audit infrastructure/platform; Employee event meaning; client boundary risk | `__tests__/audit-log-display.test.ts`, audit query tests |
| LINE/LIFF | Shared/platform server | LINE notification and LIFF identity inspect User + Employee state | Workforce identity/capability and delivery recipient resolution | LINE owns tokens/link/delivery; Auth/Workforce composes eligibility; Leave/Routine/Stock supply capabilities | LINE/Liff/home/app notification tests |
| Outbox | Shared/platform server | No direct Employee business reference found in `lib/services/outbox/**` | Feature notification intent reaches global processor | Delivery/composition owns processor; modules may enqueue only | Outbox processor tests |

## 4. Employee server behavior inventory

### 4.1 Route contract preservation table

The following is the current behavior contract for F1. Statuses and response
shapes are recorded as observed; F1 must preserve them before any separate API
redesign is considered.

| Method and path | Authentication/authorization | Request and validation | Response and status behavior | Persistence and side effects |
| --- | --- | --- | --- | --- |
| `GET /api/employees` | `requireApiSession`; unauthenticated returns `401` | Query `search`, `status`, `page`, `limit` through `employeeFiltersSchema`; page defaults to `1`, limit to `10`, limit range `1..100`, status is an Employee status or `all` | Success `200`: `{ success: true, employees, pagination }`; invalid filters `400`; unexpected error sanitized as `500` | `getEmployees` excludes `deletedAt != null` and bootstrap admin emails, searches first/last/nickname/email/position/affiliation/department name, counts and fetches in parallel, includes department and selected linked User, orders newest first; no audit observed |
| `POST /api/employees` | `requireAdminSession`; unauthorized/forbidden returns `403` | JSON parsed after auth; `createEmployeeSchema` requires names, email, position, and positive `departmentId`; phone and optional fields normalized by schema | Validation `400`; service business failure uses its status/error; success `201`: `{ message, employee }`; unexpected failure `500` | Creates an Employee only; service requires `@thainhf.org` and checks non-deleted Employee email; no User account is created. Route schedules `EMPLOYEE_CREATE` audit after response |
| `PATCH /api/employees/[id]` | ID/body validation occurs before `requireAdminSession`; then admin-only | ID must be decimal positive safe integer; body uses `updateEmployeeSchema`; `managerId` is not part of the accepted update contract | Invalid ID/input `400`; auth response from admin guard; service business statuses include `400/404/409`; success `200`: `{ message, employee }`; unexpected failure `500` | Profile updates are serializable and lock Employee/User rows; linked User name/email are synchronized; status changes run lifecycle transitions. Service records lifecycle audit for transitions; route schedules an audit when service did not record one |
| `DELETE /api/employees/[id]` | Admin auth occurs before ID parsing | ID must be decimal positive safe integer | Invalid ID `400`; auth response from admin guard; business errors include `404/409`; success `200`: `{ message }`; unexpected failure `500` | This is a soft offboard, not a physical delete. It runs the Employee lifecycle transaction and synchronizes linked User/session state. Route schedules `EMPLOYEE_DELETE` only when the service did not record it |
| `GET /api/employees/stats` | `requireApiSession`; no admin-only restriction | No request parameters | Success `200`: `{ success: true, stats: { total, active, inactive, suspended, admin, academic } }`; unexpected error `500` | Direct Prisma aggregate counts. `total`, status counts, and department counts do not filter `deletedAt`, unlike list/export. No audit observed |
| `POST /api/employees/import` | `requireAdminSession`; route maps unauthorized/forbidden to `403` | JSON must contain an `employees` array; more than `1,000` rows returns `400`; route does not perform a per-row schema parse | Success `200`: English summary message plus `{ result: { success, errors } }`; invalid body/row limit `400`; unexpected failure `500` | Delegates to Employee import service. Rows are independent and partial success is returned. No route-level rate limit or Employee import audit was observed |
| `GET /api/employees/export` | `requireApiSession`; any authenticated API session may export | Query only `search` and `status`; Employee filters schema; maximum `2,000` matched records | Invalid filters or maximum exceeded `400`; success is a streamed CSV response; unexpected failure is sanitized `500` | Uses Employee list where-clause, counts first, then selects batches of `250`; schedules `DATA_EXPORT` audit with filters/count; Thai headings and filename are part of the behavior contract |
| `GET /api/departments` | `requireApiSession`; current route uses a custom `403` unauthorized response | No parameters | Success `{ departments }`; unexpected failure `500` | Directly lists all departments by name ascending. It is consumed by Employee forms/import but is not currently an Employee-owned service |

There is no observed Employee-specific request body-size guard or rate limit in
these routes. The import row cap and browser-side five-megabyte file policy are
the current controls. F1 must preserve this behavior and separately record any
hardening proposal rather than silently changing the contract.

### 4.2 Profile, lifecycle, and uniqueness rules

#### Create

- The route schema trims required first and last names and position, accepts a
  positive numeric/string `departmentId`, normalizes phone to ten digits in
  `xxx-xxxxxxx` form, and accepts a syntactically valid email.
- The Employee service additionally requires an `@thainhf.org` email and checks
  for a non-deleted Employee with the same lower-cased email.
- The database has unique constraints on Employee email, User email, and
  User-to-Employee link. A create operation creates no User account and does
  not assign a manager.
- The default Employee status is `ACTIVE` from Prisma. Create input does not
  supply a lifecycle status.

#### Profile update

- First name, last name, nickname, phone, position, affiliation, department,
  and email are optional update fields. Empty optional text becomes `null` or
  the existing compatibility representation as defined by the current schema.
- An email that is blank or `-` becomes a generated `@temp.local` address only
  for an unlinked Employee. A linked User cannot lose the organizational email.
- Non-temporary email updates must be syntactically valid and end in
  `@thainhf.org`. Employee and User email conflicts are checked in the
  serializable transaction. Linked User name and email are synchronized from
  Employee data.
- The route/schema does not accept `managerId`; the current Employee API has no
  general manager mutation.

#### Status transition and offboarding

The current lifecycle use case accepts `OFFBOARD`, `SUSPEND`, and `REACTIVATE`
and uses row locks plus a serializable transaction:

| Operation | Employee write | User/session write | Guards and audit |
| --- | --- | --- | --- |
| Offboard / `DELETE` | `status = INACTIVE`, `deletedAt = now` | linked User `isActive = false`; token version increments; non-revoked refresh tokens are revoked | Blocks self-offboarding, removing the last active admin, targets with active subordinates, or targets with relevant pending/approved Leave action dependencies; records Employee delete audit |
| Suspend | `status = SUSPENDED`, `deletedAt` remains `null` | linked User `isActive = false`; token version increments; refresh tokens are revoked | Uses the same deactivation safety checks; records status-change audit |
| Reactivate | `status = ACTIVE`, `deletedAt = null` | linked User `isActive = true`, `deletedAt = null`; token version increments; refresh tokens are revoked | Re-enables the Employee/account pair and records status-change audit |

No physical Employee delete was found. The service also supports a no-op
transition path that can still update profile data and avoids duplicate audit
records when the transition did not change state.

#### Hierarchy and manager assignment

- `Employee.managerId` is nullable and points to another Employee. The
  subordinate collection is used by Auth session projection, lifecycle guards,
  and Leave reporting/approval behavior.
- No Employee route/service mutation for `managerId` was found. The current
  `modules/leave/application/approvals/approver-assignment.ts` updates this
  field as part of Leave-specific approver assignment, with active employee,
  active linked User, email, self-assignment, duplicate, pending-request, and
  audit/concurrency rules.
- F1 must introduce a deliberate seam for changing the Employee-owned
  hierarchy relation while allowing Leave to retain its Leave-specific
  preconditions and transaction semantics. It must not move the whole Leave
  approver assignment use case into Employee.

#### Duplicate and validation locations

| Rule | Current location(s) | F0 finding |
| --- | --- | --- |
| Required names/position/department ID | `lib/validations/employee.ts`, UI forms | Route and client schema behavior must be preserved; import has a separate required-field path |
| Email syntax and organization domain | Zod route schema, Employee service, import service | Domain enforcement is duplicated and differs between create schema/service/import; document before consolidating in F1 |
| Employee email uniqueness | Service query, serializable update transaction, Prisma unique constraint | Keep both application feedback and DB race protection |
| User email uniqueness/synchronization | Profile update transaction, signup transaction, Prisma unique constraint | Cross-aggregate behavior requires an explicit Auth/platform integration seam |
| Department validity | Prisma foreign key, Employee form lookup, import code/name mapping | Import and form semantics are not identical to a generic Department API |
| Status values | Prisma enum, validation schema, constants, CSV parser | Future domain value must not leak Prisma runtime types to clients |
| Manager/hierarchy safety | Leave approver assignment and Employee lifecycle guards | No generic Employee manager command exists yet; this is a required F1 design seam |

## 5. Import workflow audit

Employee import is a distinct Employee sub-capability. Its current behavior is:

### Input and file policy

- The browser accepts `.csv` only, with a maximum file size of five megabytes.
  Empty MIME type is allowed; known CSV MIME types are accepted. A basic
  signature/null-byte check rejects common binary signatures, including ZIP
  (therefore XLSX), PDF, PNG, JPEG, EXE, and ELF.
- Employee import does not accept `.xls` or `.xlsx`. The repository's XLSX
  import behavior belongs to Routine and must not be copied into Employee by
  assumption.
- The client previews up to the first 100 parsed rows and enforces a 1,000-row
  cap before posting. The route and service also enforce the 1,000-row cap.
- The server endpoint receives JSON rows, not the original file. It only checks
  that `employees` is an array; it does not re-run a row schema at the route
  boundary.

### Columns and parsing

`lib/helpers/csv-helpers.ts` maps Thai and English aliases for first name, last
name, email, phone, position, department, affiliation, nickname, and status.
Required columns are first name, last name, position, and department. The parser
strips a UTF-8 BOM, ignores blank lines, records the source row, and handles
basic quoted commas. It does not implement multiline quoted CSV records.

### Normalization and validation

- Names and position are trimmed. Blank optional phone, affiliation, and
  nickname values become null-like values for the service; blank/dash email is
  handled as a generated temporary email as described below.
- Email is lower-cased and must be a basic valid `@thainhf.org` address when
  supplied. A blank/dash email gets a generated unique-looking
  `no-email-<timestamp>-<random>@temp.local` value.
- Department input is upper-cased and mapped through the current compatibility
  map: `ADMIN`/`บริหาร` and `ACADEMIC`/`วิชาการ`. It must match a Department
  record by code; no other department mapping is accepted by the current
  service.
- Status defaults blank/dash to `ACTIVE`. Accepted textual forms include
  `active`/`ทำงานอยู่`/`ปกติ`, `inactive`/`ไม่ทำงาน`/`ลาออก`, and
  `suspended`/`ถูกระงับ`. Unknown non-empty status is an error.
- Existing non-deleted Employee emails are rejected, except temporary emails;
  duplicate normalized full names within the same import are rejected. The
  in-memory duplicate sets also catch duplicates within the uploaded file.

### Persistence and result semantics

- Each row calls `prisma.employee.create` independently. There is no outer
  transaction and the import is partial-success: valid rows remain committed
  when other rows fail; processing continues after per-row errors.
- Import sets Employee profile fields, department, and parsed status. It does
  not set `managerId`, `hireDate`, or create/link a User account.
- The service returns successful normalized rows (including department name)
  and errors containing source row, input data, and error text. The UI displays
  only a bounded subset of errors and posts the result to the user.
- No Employee import audit event, rate limit, or server-side file retention was
  found. These are behavior observations, not F0 fixes.

F1 target: `application/import` owns Employee row meaning and all-or-partial
semantics; `infrastructure/import` owns CSV parser/technical adapters; the
route remains a thin adapter. The existing behavior must be characterized by
tests before any transaction or validation consolidation.

## 6. Export workflow audit

Employee export is a report/data-delivery flow with three distinct concerns:

1. Employee owns the report row meaning, filter semantics, visibility of
   non-deleted records, status labels, temporary-email rendering, and Thai
   column headings.
2. Shared/platform owns generic CSV row encoding and streaming response
   mechanics.
3. The route owns HTTP authentication, query parsing, response construction,
   and audit scheduling.

Current behavior:

- Any authenticated API session can export; admin authorization is not required
  by the current route.
- Filters are `search` and `status`; list where-clause semantics exclude
  soft-deleted Employees and bootstrap admin emails. The route counts first and
  rejects more than 2,000 matched rows.
- Rows are selected in batches of 250, ordered by `createdAt DESC, id DESC`.
- The UTF-8 CSV header is exactly:

  ```text
  ลำดับ,ชื่อ,นามสกุล,ชื่อเล่น,ตำแหน่ง,สังกัด,แผนก,อีเมล,เบอร์โทร,สถานะ
  ```

- Empty optional values render as `-`; temporary `@temp.local` emails render
  as `-`; statuses use the current Thai Employee labels.
- Filename generation starts with `รายชื่อพนักงาน`, optionally includes
  sanitized Thai search/status suffixes, and uses the shared date filename
  helper with the `.csv` extension.
- A `DATA_EXPORT` audit is scheduled with entity type, record count, filters,
  and export timestamp. The CSV stream itself has no Employee-specific
  workbook dependency.

F1 should expose a report-row/export contract without exposing Prisma selects or
the stream implementation through the public module API.

## 7. Search, list, and stats audit

### Employee list/search

`getEmployees` clamps page to at least 1 and limit to 1..100, performs count and
row retrieval in parallel, and orders by `createdAt DESC`. The normal search is
a contains query over:

```text
firstName, lastName, nickname, email, position, affiliation, department.name
```

The list excludes soft-deleted Employees and bootstrap admin emails. It
includes the Department and a selected linked User projection (`id`, `email`,
`role`). `getEmployeeById` uses a cached query and also excludes soft-deleted
Employees. `emailExists` lower-cases the candidate and checks non-deleted
Employee records, with an optional self-exclusion ID.

### Stats

`GET /api/employees/stats` directly counts:

```text
total       all Employee rows, including soft-deleted rows
active      Employee.status = ACTIVE
inactive    Employee.status = INACTIVE
suspended   Employee.status = SUSPENDED
admin       Department.code = ADMIN
academic    Department.code = ACADEMIC
```

The stats response contains all six values, but the current
`EmployeeStatsCards` UI model renders only total, active, admin, and academic.
This is an existing contract/UI discrepancy and is not changed in F0.

The likely Employee application contracts are `listEmployees`,
`getEmployeeById`, `getEmployeeStats`, and a pure filter/value contract. The
query implementation should remain able to support Leave/Routine transaction
queries without turning every cross-feature read into a network-like service
call or an N+1 sequence.

## 8. Employee presentation and client API audit

### Active browser flow

- `EmployeeManagementSection` creates the Employee provider and composes the
  stats/list UI. Admin-only buttons for add/import/export are UI visibility;
  server admin guards remain authoritative.
- `EmployeeProvider` uses SWR for list and stats, keeps previous list data while
  paging, debounces search, stores status/page/modal/export state, and
  revalidates list/stats after mutations.
- `EmployeeList` owns search/filter/result/empty/error/retry/pagination
  composition and renders `EmployeeTable`/mobile primitives and modals.
- `AddEmployeeForm` and `EditEmployeeForm` use the shared form fields and
  client-side Employee schemas; their hooks fetch departments and call generic
  API adapters. They revalidate or close UI state after success.
- Import presentation is a step flow: file validation, parse, preview,
  submit, and result/error display. It uses Employee CSV helpers and generic
  download/toast/SWR facilities.
- Employee dashboard pages use `requireDashboardAdmin` for new/import routes,
  while the main page is composed under the existing Dashboard session/layout.

### Context ownership decision

`components/dashboard/context/employee/EmployeeContext.tsx` and
`EmployeeProvider.tsx` represent Employee feature state, not global workforce
identity or session state. They should move to something like
`modules/employee/presentation/dashboard/context/` in F2. Generic Dashboard
navigation, UI messaging, and session contexts stay outside Employee.

### Browser adapters found

The current feature does not have a dedicated Employee API adapter module. It
uses generic `apiGet`/`apiPost`/`apiPatch`, route SSOT constants, SWR, toast,
download, and debounce helpers directly from legacy presentation code. F2
should centralize only Employee-facing browser adapters that have real reuse;
it should not expose the server application API to the browser.

### Proposed presentation target

```text
modules/employee/presentation/dashboard/
  EmployeeManagementSection
  AddEmployeeSection
  context/
  components/
  hooks/
  api.ts
modules/employee/presentation/import/
  ImportEmployeeRouteContent
  ImportEmployeeCSV and step components
```

The exact subfolders are proportional guidance. The important boundary is that
feature UI, feature hooks, feature context, and browser API adapters move
together, while `app/dashboard/employees/**` remains route composition and URL
compatibility.

## 9. Type, schema, and Prisma leakage audit

### Type ownership map

| Current type source | Current contents | Future owner |
| --- | --- | --- |
| `lib/services/employee/types.ts` | Filters, create/update commands, import rows/errors/results, Employee-with-relations and pagination result, service actor | Split between Employee domain/application/reference contracts and server DTOs |
| `lib/validations/employee.ts` | Create/update/filter Zod schemas and inferred input types | `modules/employee/schemas/` for route/application input; derive input types from schemas |
| `types/employees.ts` | Employee/Department/User shapes, form data, CSV data, import results, table/modal props, update data | Persistence-independent domain/reference types, route DTOs, and presentation-local types; legacy facade only temporarily |
| `types/api.ts` | Legacy `GetEmployeesResponse` and Department response | Compatibility type only; current paginated API DTO must become authoritative in Employee server/presentation contracts |
| `components/dashboard/context/employee/types.ts` | Provider/UI state and context values | Employee presentation-local types |
| `components/employee/import-csv/types.ts` | Import step/file/preview/result UI state | Employee presentation/import-local types |
| `components/employee/shared/types.ts` | Form field/presentation props | Employee presentation-local types |
| `@prisma/client` Employee/Department/User payloads | Persistence models and enum values | Infrastructure-only; map to Employee domain/reference/API types before public export |

### Prisma leakage

- No direct `@prisma/client` import was found in the Employee React component
  tree or Employee dashboard route components.
- `lib/services/employee/types.ts` imports Prisma Employee/Department/status
  types for server-side service contracts. These are type-level persistence
  leaks and should be replaced with module-owned types during F1.
- `lib/helpers/csv-helpers.ts` imports `EmployeeStatus` as a runtime Prisma
  enum. The same file is reachable from the browser import UI and also contains
  Leave CSV helpers. This is the most important Employee client/server leakage
  risk to split before F2 client-entry enforcement.
- Validation and UI constants currently use string status values independently
  of Prisma, so a future module must have one domain status representation and
  explicit adapters rather than exporting a Prisma enum.
- Auth, Leave, Routine, and Stock server code may use typed Prisma projections
  internally, but those payloads must not become the Employee public API or be
  exported from `client.ts`.

## 10. `lib/helpers/employee-helpers.ts` ownership audit

The helper file is mixed responsibility. It must not be moved wholesale to
`shared/` merely because several features import it.

| Export | Meaning/change owner | Recommendation | Real consumers found |
| --- | --- | --- | --- |
| `getEmployeeStatusLabel` | Employee status presentation vocabulary | Employee presentation/client-safe formatter; keep server equivalent available without Prisma | Employee UI, Employee export, audit/feature presentation paths |
| `getEmployeeStatusBadge` | Employee UI styling vocabulary | Employee presentation-local; do not make it shared business policy | Employee table/status UI |
| `getEmployeeStatusInfo` | Employee status option metadata | Employee presentation/client-safe contract if reused outside Employee UI | Employee status UI/forms |
| `getEmployeeStatusValueFromLabel` | Employee CSV/form label parsing | Employee import/presentation contract; do not expose merely for tests | Employee import/status input |
| `isEmployeeActive` | Employee status-only predicate | Employee domain/presentation helper, explicitly not full workforce eligibility because it ignores `deletedAt` and User state | Employee UI and feature code |
| `isEmployeeSuspended` | Employee status-only predicate | Employee domain/presentation helper | Employee UI/legacy consumers |
| `getEmployeeFullName` | Pure Employee identity formatting | Employee identity contract; safe in server and client entries | Employee service, signup, Routine, UI, tests |
| `getEmployeeDisplayName` | Employee full name plus nickname | Employee identity contract; expose a structural, client-safe formatter | Employee API/export/UI, Leave, Routine, Stock, audit |
| `getEmployeeInitials` | Pure Employee presentation formatting | Employee client/presentation-local formatter | Employee avatar/table presentation |
| `getEmployeeEmailStatus` | Employee temporary/valid/invalid display classification | Employee export/presentation contract; not an Auth credential validator | Employee export/UI |
| `formatEmployeePhone` | Employee phone display formatting | Employee presentation/export contract | Employee UI |
| `getEmployeeDepartmentLabel` | Current Employee/Department display mapping (`ADMIN`/`บริหาร` vs fallback) | Keep with Employee/Department presentation until a reference-data module exists; do not classify as generic shared formatting | Employee UI and import/export-adjacent paths |
| `getEmployeeDepartmentBadgeClass` | Current Employee/Department UI styling | Employee presentation-local | Employee UI |
| `getEmployeeBackedUserDisplayName` | Composite User → Employee/name/email fallback identity projection | Do not make generic platform code import the Employee server entry. Either extract a structural Auth/workforce display helper or provide a deliberately client-safe identity contract; final extraction belongs in F1/F2 design | Auth server/LIFF, audit display, Leave, Routine, Stock, notifications/reports |

The last export is not merely an Employee formatter: it decides fallback order
between a linked Employee, `User.name`, `User.email`, and a Thai fallback. Its
meaning is account identity composition. It should be coordinated with
Auth/Workforce/platform rather than forcing every User-facing feature to depend
on Employee internals.

## 11. Employee ↔ Auth / Workforce boundary

### Direct Auth consumers

The following Auth paths directly query or interpret Employee state:

```text
lib/auth/ssot.ts
lib/auth/server.ts
lib/auth/api.ts
lib/auth/liff.ts
lib/auth/hybrid/route.ts
lib/auth/workforce.ts
lib/auth/workforce-transaction.ts
app/api/auth/hybrid-login/route.ts
app/api/auth/signup/route.ts
```

They inspect combinations of `User.isActive`, `User.deletedAt`,
`User.employeeId`, linked Employee `status`, and Employee `deletedAt`. This is
not evidence that all of these rules belong to Employee. The rule owner is:

| Behavior | Owner |
| --- | --- |
| Password validation/hash, login/logout, access/refresh tokens, token version, cookie/session-family validation, session revocation, CSRF, and auth rate limiting | Auth/platform |
| Employee names, organization fields, Employee status and Employee soft-delete transition policy | Employee |
| “Resolve authenticated user to an active Employee/workforce identity” and combined User + Employee eligibility | Existing Auth/Workforce boundary in `lib/auth/workforce*`; no new module in F0 |
| Session projection of department/name/manager/capabilities | Auth session composition; source data/policies remain Employee and Leave respectively |
| Leave approval capability and approver history semantics | Leave; Auth calls the Leave public API when building session projections |
| LIFF cookie/JWT/session token mechanics and LINE account linkage | LINE/platform; Employee contributes only identity/lifecycle state |

### Current lifecycle rule, exactly as implemented

The current repository has more than one related gate. F0 records all of them
because F1 must not accidentally normalize the behavior:

| Flow | Current eligibility rule |
| --- | --- |
| Employee-only predicate `hasEligibleEmployeeLifecycle` | Returns true for `null` Employee; otherwise requires `status = ACTIVE` and `deletedAt = null` |
| API session `getApiAuthSession` | Requires an active/non-deleted User, a linked Employee, Employee `ACTIVE`, Employee `deletedAt = null`, valid session family, and matching token version |
| `requireActiveWorkforceSession` | Requires active/non-deleted User plus a linked Employee with `ACTIVE`/non-deleted lifecycle; missing Employee is `404`, inactive Employee is forbidden |
| `requireActiveWorkforceOrAdminSession` | An active admin may pass without an Employee; non-admin requires the active Employee condition |
| Transactional workforce gate | Locks User and Employee, then requires matching `User.employeeId`, active/non-deleted User, and active/non-deleted Employee |
| Hybrid login and low-level authenticated-user resolution | Active/non-deleted User, matching token/session state, and `hasEligibleEmployeeLifecycle`; because the helper accepts null, an unlinked User can pass this lower-level path. Existing tests cover the unlinked case |
| LIFF workforce identity | Requires active/non-deleted User, non-null linked Employee, `User.employeeId === Employee.id`, Employee `ACTIVE`, Employee `deletedAt = null`, and optional expected Employee ID match |
| App LINE notification eligibility | Requires active/non-deleted User; a non-null `employeeId` must resolve to an Employee; linked Employee must be `ACTIVE`/non-deleted. An unlinked active User may be eligible for delivery, but a missing LINE link is then skipped as `UNLINKED` |
| Signup | Requires an existing Employee matched by exact normalized email, Employee eligible under the helper, and no linked User; serializable transaction locks and rechecks the Employee before creating a User |

For the Employee lifecycle transition itself:

- Offboard means Employee `INACTIVE` plus soft-deleted; linked User becomes
  inactive and active refresh tokens are revoked.
- Suspend means Employee `SUSPENDED` without setting Employee `deletedAt`;
  linked User becomes inactive and sessions are revoked.
- Reactivate means Employee `ACTIVE` and not deleted; linked User becomes
  active and not deleted and sessions are revoked.
- User lifecycle fields and Employee lifecycle fields are separate state. A
  linked account can therefore be inconsistent between records unless a
  transaction performs the paired transition. The current Employee service
  does pair them for its lifecycle operations.

F0 decision: Employee owns the canonical Employee-only lifecycle state/policy;
Auth/Workforce owns the combined account-to-workforce eligibility contract and
must retain the current null/unlinked exceptions until a separately approved
behavior change. Auth infrastructure remains responsible for token/session
revocation. F1 should use a narrow Employee contract or platform port rather
than importing Employee internals into Auth.

## 12. Employee ↔ Leave boundary

`modules/leave/` is already E1/E2/E3-complete and currently reads Employee data
directly in several Leave-owned transactional queries and reports. This is not
automatically a boundary violation: a query can remain in Leave when its
selection and transaction semantics are determined by a Leave rule.

### Leave-owned behavior

- Requester Employee eligibility and Leave profile access.
- Creating a Leave request, including reading the requester Employee,
  requiring an active Employee, requiring a configured manager, and snapshotting
  `approverId` from the current `Employee.managerId`.
- Leave approver assignment, pending-request guards, approver eligibility,
  current action recipient, and exception approver resolution.
- The meaning of `approverId`, `exceptionApproverId`, original/current
  approver snapshots, cancellation/not-taken decisions, Leave notifications,
  and Leave report scope.
- Leave-specific report queries that select active subordinates by
  `managerId`, or historical Employees related to Leave requests.

### Employee-owned data consumed by Leave

- Employee identity fields and display projection.
- Employee status and soft-delete state.
- Department and position values used in Leave reports.
- The organizational `managerId` relationship and subordinate records.
- User linkage/email where Leave needs a notification or approver recipient.

### Important distinction

```text
Employee owns who reports to whom: Employee.managerId.
Leave owns what that relationship means for Leave approval.
Leave owns exception approver assignment and policy; it is not an Employee
manager relationship merely because it stores an Employee ID.
```

The current Leave approver-assignment use case writes `Employee.managerId`.
F1 must preserve its transaction and Leave-specific policy while establishing a
public Employee hierarchy mutation seam. Leave must not deep-import
`modules/employee` internals, and Employee must not absorb Leave approval
policy.

### Future dependency rule

If Leave needs Employee behavior rather than a projection of Employee data, it
must consume a narrow `@/modules/employee` public contract. Leave-owned
transactional persistence queries may continue to select Employee fields when
that is required for atomic Leave rules, but the exception must be deliberate,
documented, and re-audited in F3. F0 does not add a Leave → Employee import or
change the completed Leave module.

## 13. Employee ↔ Routine / Stock / other feature map

### Routine

Routine currently reads Employee data in:

```text
modules/routine/application/authorization.ts
modules/routine/application/queries.ts
modules/routine/application/mutations.ts
modules/routine/application/recipients.ts
modules/routine/application/scheduler.ts
modules/routine/application/reminders.ts
modules/routine/application/contract-reminders.ts
modules/routine/application/imports/staging.ts
modules/routine/application/imports/owner-mapping.ts
modules/routine/presentation/dashboard/labels.ts
modules/routine/presentation/dashboard/RoutineAssigneePicker.tsx
modules/routine/presentation/dashboard/RoutineTaskForm.tsx
modules/routine/presentation/dashboard/types.ts
```

Routine owns:

- assignee membership and `OWNER`/`CO_OWNER` meaning;
- routine authorization scope;
- active-assignee validation as a Routine rule;
- notification readiness and recipient selection;
- import owner-name mapping, duplicate/unresolved-owner review, and Routine
  import semantics;
- Routine display/serialization of a selected assignee.

Employee owns the base Employee identity, lifecycle state, department ID, and
organizational hierarchy that Routine reads. Routine's current direct
transactional `employee` queries can remain Routine-owned where they are part
of assignment/import/notification rules. A future narrow Employee reference
projection may replace repeated display/lifecycle reads, but F0 does not force
an API call or a cross-module dependency that would weaken transaction
semantics.

### Stock

Stock Employee touchpoints are primarily linked User/Employee display data:

```text
modules/stock/application/requests/request-creation.ts
modules/stock/application/requests/request-mutations.ts
modules/stock/application/queries/queries.ts
modules/stock/infrastructure/notifications/notification-payloads.ts
modules/stock/infrastructure/notifications/notifications.ts
modules/stock/infrastructure/persistence/shared.ts
modules/stock/infrastructure/reports/report-workbook.ts
modules/stock/presentation/liff-serialization.ts
modules/stock/presentation/dashboard/components/StockAdminRequests.tsx
modules/stock/presentation/dashboard/components/StockRequestMobileCards.tsx
modules/stock/presentation/dashboard/components/StockRequestNote.tsx
```

Stock owns inventory/request/issuer/notification/report meaning. It does not
own Employee lifecycle, department policy, or hierarchy. Future Stock client
code may consume a client-safe identity formatter; Stock server persistence
may retain a structural User/Employee display projection when it is part of a
Stock report/notification query. No Stock → Employee internal import is
planned.

### Other feature and platform consumers

| Consumer | Employee concept read | Future owner/contract |
| --- | --- | --- |
| `lib/audit-log/display.ts`, `components/audit/AuditLogViewer.tsx` | Employee/User display name in generic audit presentation | Audit remains platform-owned; use a safe structural formatter or `@/modules/employee/client`, never the Employee server barrel from a client graph |
| `lib/services/audit-log/queries.ts` | Employee names for audit search/display | Audit query infrastructure remains shared/platform; Employee identity projection is a narrow input contract |
| `lib/server/audit.ts` | Employee event names/snapshots and generic data-export events | Generic audit delivery remains platform; Employee owns the event meaning/data shape supplied by its use cases |
| `lib/line/app-notification.ts` | Combined User + Employee eligibility and linked LINE account | LINE/notification platform owns delivery/link state; Auth/Workforce owns combined eligibility composition |
| `lib/line/liff-session.ts`, `lib/line/liff-types.ts` | `employeeId` claim and workforce identity type | LINE/LIFF owns session token mechanics; Employee does not own LIFF JWT/cookies |
| `lib/services/outbox/**` | No direct Employee business dependency found | Global processor remains delivery/platform-owned; Employee/Routine/Leave may enqueue but must not import the processor |
| `app/dashboard/page.tsx`, dashboard navigation/menu/constants | Employee route visibility/navigation | Dashboard delivery owns navigation; UI visibility is not authorization |
| `app/dashboard/email-request/page.tsx` and email-request code | Free-text request department value | Separate email-request concern; no evidence that it should consume the Department relation or move into Employee |

No direct Employee business dependency was found in the Stock/Routine/Leave
public barrel contracts themselves. The dependencies are implementation-level
queries and legacy helper imports recorded above; F1/F2/F3 must convert only
where a real ownership contract benefits from it.

## 14. Department ownership decision

### Evidence

- `Department` is a separate Prisma model with unique `name` and `code` and an
  Employee relation.
- The repository has only `app/api/departments/route.ts` for Department
  delivery; no Department service, mutation workflow, UI module, or public
  module exists.
- Employee create/edit forms fetch Department records.
- Employee import maps only `ADMIN`/`บริหาร` and `ACADEMIC`/`วิชาการ`, then
  requires matching database codes.
- Employee stats hard-code `ADMIN` and `ACADEMIC` department codes.
- Other features can carry/read `departmentId`, while email-request uses a
  separate free-text department field.

### Decision

The recommendation is **C: a future organization/reference-data capability**.
Until that capability is separately migrated, Department remains a
transitional legacy reference-data concern. Employee owns:

- the fact that an Employee has a department association;
- Employee form/import validation that currently requires a Department;
- Employee-specific display/report use of the relation.

Employee does not absorb all Department routes or invent a Department module in
F0. F1 may use a narrow Department reference port only if the Employee server
boundary needs one; the route/API contract remains unchanged.

## 15. Manager, hierarchy, and approver ownership

The final rule is:

```text
Employee owns the organizational hierarchy: managerId, subordinates, and
generic “who reports to whom” data.

Leave owns approval interpretation: when a manager becomes approver, how
approvers are assigned/reassigned, what pending Leave work blocks a change,
and how exception approvers are resolved.

Routine and Stock do not acquire manager semantics merely because they read an
Employee ID or display a name.
```

Current implementation is transitional because Leave's approver-assignment
application use case mutates `Employee.managerId`. This is the one important
cross-boundary mutation to address in F1 design. The safe migration shape is a
generic Employee hierarchy command/transaction seam invoked by Leave, with
Leave retaining its preconditions, assignment meaning, audit details, and
concurrency behavior. It must not become a generic “Leave approver” API in
Employee.

`Employee.managerId` and Leave `exceptionApproverId` are not interchangeable:

- `managerId` is a durable organizational relationship.
- `approverId` is the approver snapshot/assignment for a Leave request.
- `exceptionApproverId` is a Leave-specific exception flow assignment.

## 16. Signup and account-provisioning boundary

Current signup is an Auth/account-provisioning workflow:

1. Trusted mutation, JSON/auth signup schema validation, identity/IP rate
   limiting, and existing User email check occur in `app/api/auth/signup`.
2. Auth looks up an Employee by exact normalized email and requires the current
   Employee lifecycle eligibility helper to pass.
3. It rejects a missing/ineligible or already-linked Employee.
4. A serializable transaction locks and re-reads the Employee, verifies email,
   lifecycle, and unlinked state, then creates the User with Employee link,
   role, active state, and full name.
5. Unique races return `409`; the signup route writes a User audit. Session
   creation is performed by the client through hybrid login afterward.

Employee admin create is a different flow: it creates an Employee but does not
create a User. The migration must preserve that distinction.

Future direction: Auth/Signup remains the workflow owner and may consume a
narrow Employee server contract such as “find/claim an eligible Employee for
account linking.” The contract must preserve the shared transaction/row-lock
and re-read semantics without exposing Prisma models or moving password/session
creation into Employee. F1 must decide whether the transaction seam is a
shared platform port or an Employee application operation invoked from the
Auth transaction; F0 does not change the route.

The real consumer for this contract is `app/api/auth/signup/route.ts`, and the
concurrency proof is
`__tests__/integration/signup-employee-concurrency.integration.test.ts`.

## 17. Audit, session display, LINE, and client/server risks

### Audit display risk

`components/audit/AuditLogViewer.tsx` is client-reachable through
`lib/audit-log/display.ts`. That display helper currently uses Employee-backed
display formatting and Leave client-safe formatters. The completed Leave
migration demonstrated that a generic client-reachable helper importing a
server module entry can pull server-only code into the client graph.

Before F2, Employee display exports must therefore be split explicitly:

```text
client-safe pure Employee formatter -> @/modules/employee/client
server/application Employee use case -> @/modules/employee
```

Or the audit/platform layer may keep a structural formatter that does not
depend on Employee at all. `getEmployeeBackedUserDisplayName` requires an
explicit decision because it composes User and Employee identity.

### Other client-reachable risks

- Employee import presentation reaches `lib/helpers/csv-helpers.ts`, whose
  runtime Prisma enum import and mixed Leave code must be split before a strict
  Employee client entry is enforced.
- Generic audit display, Stock/Routine/Leave client components, and shared
  table/form helpers currently import the legacy Employee helper. F2 must
  audit every runtime edge, not just direct imports.
- Type-only Prisma imports may be erased safely, but runtime Prisma imports,
  filesystem/workbook/database adapters, and server application use cases must
  never be exported from `client.ts`.

### Guardrail timing

F0 adds no Employee checker rule because `modules/employee/` does not exist.
Once F1 creates the real module, the architecture checker should add the same
public-entry/client-entry rules used by migrated modules, including rejection
of deep Employee imports and client-reachable server dependencies. Existing
legacy Employee paths must remain allowed as compatibility paths until their
respective F1/F2/F3 slice closes.

## 18. Proposed future module shape

Employee is large enough to justify proportional domain, application,
infrastructure, presentation, and schema boundaries. The following is a
target, not a request to create empty folders in F0:

```text
modules/employee/
├── domain/
│   ├── lifecycle and Employee-only eligibility
│   ├── identity/reference value contracts
│   └── hierarchy invariants
├── application/
│   ├── employees/list, detail, create, update, stats
│   ├── lifecycle transitions and hierarchy command
│   ├── account-link/signup seam
│   ├── import/
│   └── export/
├── infrastructure/
│   ├── persistence/
│   ├── import/CSV technical adapter
│   ├── export/CSV/report technical adapter
│   └── platform ports/adapters where concrete reuse is required
├── presentation/
│   ├── dashboard/
│   └── import/
├── schemas/
│   ├── employee route input
│   └── import input/DTO validation
├── server/
│   └── concrete HTTP/serialization adapters only if multiple routes need them
├── index.ts
└── client.ts
```

Layer decision:

- `domain/`, `application/`, `infrastructure/`, `presentation/`, and
  `schemas/` have distinct real responsibilities and are warranted.
- `server/` is conditional rather than ceremonial. Employee has streamed
  export, import body handling, and route serialization, so a thin server
  adapter is likely useful; F1 must create it only with concrete contracts,
  not an empty placeholder.
- `index.ts` is server/application-oriented. `client.ts` is client-safe only.
- Prisma payloads, repositories, import internals, session/token mechanics,
  and generic Dashboard contexts are not public module contracts.

## 19. Proposed server public API

These are proposed contract categories, not implemented exports. Every listed
contract has a real production consumer. Names may be refined in F1 while the
ownership and input/output boundaries remain stable.

### Route contracts

| Proposed contract | Real consumer | Contract intent |
| --- | --- | --- |
| `employeeFiltersSchema` or a route-safe `parseEmployeeFilters` | `app/api/employees/route.ts`, `app/api/employees/export/route.ts` | Preserve search/status/page/limit parsing and current errors without exporting Prisma types |
| `createEmployeeSchema`, `updateEmployeeSchema` or route-safe parsers | `app/api/employees/route.ts`, `app/api/employees/[id]/route.ts` | Preserve current request validation; route schemas are not test-only exports |
| `listEmployees` and `getEmployeeById` | Employee list route and future detail consumer | Paginated Employee DTOs with explicit reference/user fields, not raw Prisma payloads |
| `createEmployee` and `updateEmployeeProfile` | Employee POST/PATCH route | Profile application commands and committed DTOs |
| `changeEmployeeLifecycle` plus explicit offboard/delete compatibility command | Employee PATCH/DELETE routes; Auth/Workforce side-effect seam | Preserve OFFBOARD/SUSPEND/REACTIVATE guards, locks, audit snapshot, and paired User/session effects |
| `getEmployeeStats` | `/api/employees/stats` | Preserve six current aggregate values, including current soft-delete inclusion semantics until separately changed |
| `importEmployeesFromCsvRows` | `/api/employees/import` and F2 browser import adapter | Preserve row normalization, 1,000-row cap, duplicate handling, partial success, and result DTO |
| `createEmployeeExport` or a report-row stream contract | `/api/employees/export` | Preserve filters, 2,000-row limit, 250 batching, Thai columns/labels, filename inputs, and audit metadata without leaking the stream implementation |

### Auth/workforce contracts

| Proposed contract | Real consumer | Contract intent |
| --- | --- | --- |
| `getEmployeeLifecycleState` / `isEligibleEmployeeLifecycle` | `lib/auth/workforce.ts`, `workforce-transaction.ts`, hybrid/LIFF/LINE composition | Employee-only status/deleted semantics; must document that User/session state is not included |
| `findSignupEligibleEmployee` and a transaction-safe `linkEmployeeAccount` seam | `app/api/auth/signup/route.ts` | Preserve exact email, unlinked check, row lock, serializable re-read, and concurrent signup/update behavior; do not move credentials into Employee |
| `EmployeeWorkforceReference` structural type/lookup contract, if F1 proves it is needed | Existing Auth/Workforce and LIFF identity composition | Narrow Employee identity/lifecycle projection; no User session/token implementation and no raw Prisma payload |

### Cross-module contracts

| Proposed contract | Real consumer | Contract intent |
| --- | --- | --- |
| `EmployeeReference` / `EmployeeDisplayNameSource` structural types | Leave, Routine, Stock, audit/report composition | Share a stable projection shape without exposing Employee repositories or Prisma models |
| `getEmployeeDisplayName` pure formatter | Employee server/UI, Leave/Routine/Stock server projections, audit display where a module dependency is acceptable | Canonical Employee name + nickname formatting; a separate client-safe implementation/export is required |
| `changeEmployeeManager` or equivalent hierarchy command | Leave approver-assignment use case | Employee owns the relation mutation; Leave retains approver-specific validation, pending-request blocking, audit meaning, and transaction coordination |

The initial Employee public API should not export a generic “Leave approver,”
“Routine assignee,” or “Stock recipient” operation. Those meanings remain in
their owning modules. It should also not expose `Prisma.Employee`, repository
objects, workbook internals, or a User credential operation.

### Platform contracts

Employee application code may consume existing shared/platform capabilities for
database transactions/locks, audit, CSV/HTTP response, and session revocation.
Those capabilities should be injected or called through narrow platform
interfaces where needed. Employee must not export or call the global outbox
processor, own LINE session tokens, or reimplement authentication.

## 20. Proposed client public API

`modules/employee/client.ts` should expose only real route-facing and
client-safe presentation contracts:

| Proposed export | Real consumer | Why it is public |
| --- | --- | --- |
| `EmployeeManagementSection` and its loading/skeleton contract | `app/dashboard/employees/page.tsx` | Feature dashboard route composition |
| `AddEmployeeSection` | `app/dashboard/employees/new/page.tsx` | Feature add route composition |
| `ImportEmployeeRouteContent` or a route-facing import composition contract | `app/dashboard/employees/import/page.tsx` | Feature import route composition and Dashboard shell integration |
| `formatEmployeeDisplayName` / client-safe Employee identity formatter | Employee presentation and any audited client consumer that genuinely needs Employee-specific display | Pure, browser-safe identity formatting without server/database imports |
| Client-safe Employee status/identity value types or formatters, only where used outside internal presentation | Employee forms/table and future client consumers | Prevent Prisma enum leakage; keep styling/components internal unless a real external consumer exists |

The client entry must not expose server use cases, Prisma types, repositories,
database/session/secret code, import persistence internals, workbook/stream
generators, or schemas exported merely for tests. Employee hooks, provider,
table primitives, and import steps should remain internal to the client entry
unless an app route or another feature has a demonstrated production need.

## 21. Compatibility and deprecation plan

### F1 compatibility

- Keep all existing `/api/employees/**`, `/api/departments`, dashboard URLs,
  Thai messages, response fields, status codes, CSV headings, filename rules,
  auth requirements, and database semantics unchanged.
- Make the existing route handlers thin adapters over the new Employee server
  contracts. Do not keep two business implementations alive.
- Keep `lib/services/employee/**`, `lib/validations/employee.ts`, legacy
  Employee types, and helper exports as compatibility facades only while
  production consumers are moved. Mark ownership and intended removal in the
  eventual F1/F2 diff, not by changing behavior in F0.
- Preserve the Employee service's User synchronization, row locks,
  serializable transactions, lifecycle guards, and refresh-token revocation.

### F2 compatibility

- Move the feature provider/context, feature components, forms, import flow,
  and browser adapters behind `modules/employee/client.ts` while retaining
  existing route/page URLs.
- Keep generic Dashboard context/navigation outside Employee.
- Split `lib/helpers/csv-helpers.ts` before the client entry can reach runtime
  Prisma or Leave-specific code.
- Replace direct legacy helper imports in client-reachable paths with either
  the client-safe Employee formatter or a neutral platform formatter.

### F3 cleanup and deprecation exit

Remove legacy Employee facades only after repository search, tests, and runtime
graph checks show no production consumers:

```text
lib/services/employee/**
lib/validations/employee.ts
legacy Employee type facades in types/employees.ts and types/api.ts
Employee-specific constants/helpers left in global locations
components/employee/** and dashboard Employee context paths
hooks/useCSVImport.ts if its orphan status is confirmed
EditStatusModal.tsx if its orphan status is confirmed
mixed Employee/Leave portions of lib/helpers/csv-helpers.ts
```

F3 must add the Employee public-entry/deep-import/client-graph checker rules,
then re-audit Auth/Workforce, Leave, Routine, Stock, audit, LINE, Dashboard,
and all tests. Removal is not authorized merely because a new module exists.

## 22. Proposed migration slices

### Phase F1 — Employee Server & Business Ownership

Include:

- Employee domain lifecycle/identity/hierarchy contracts;
- Employee application list/detail/create/update/stats use cases;
- status transitions, soft offboard, manager/hierarchy seam, and safety guards;
- Employee repository/infrastructure and transaction/locking adapters;
- Employee validation/schemas and server DTOs;
- Employee import backend semantics and Employee export/report backend;
- account-link/signup integration seam while keeping Auth workflow ownership;
- existing Employee API routes as compatibility adapters;
- server tests for routes, queries, mutations, validation, import, export,
  lifecycle concurrency, and signup concurrency preservation.

Exclude:

- Employee Dashboard/components/context/browser hooks;
- Auth UI/password/token/session redesign;
- Leave approval/exception policy migration;
- Department module creation;
- API/schema/database behavior changes.

F1 should introduce the real `modules/employee/index.ts` and only then add
hard Employee architecture enforcement incrementally.

### Phase F2 — Employee Presentation Ownership

Include:

- Employee dashboard route composition through `modules/employee/client.ts`;
- `EmployeeManagementSection`, `AddEmployeeSection`, feature components,
  forms, table/mobile states, and loading/error/empty/disabled states;
- EmployeeProvider/context and browser-facing Employee API adapters;
- CSV import presentation and preview/result flow;
- presentation-local types and client-safe identity/status formatters;
- presentation tests and client/server dependency-graph checks.

Exclude:

- Auth/signup/login UI and workforce/session behavior;
- Leave/Routine/Stock presentation redesign;
- API URL/response/permission changes;
- Prisma schema changes.

### Phase F3 — Employee Compatibility Cleanup & Final Re-audit

Include:

- remove obsolete legacy service/validation/type/helper/presentation facades;
- confirm and remove orphaned `useCSVImport`/`EditStatusModal` only if unused;
- split mixed CSV helpers and minimize `index.ts`/`client.ts` exports;
- enforce no deep imports and no Employee server entry in client graphs;
- re-audit Auth/Workforce/null Employee behavior, signup locking, Leave
  manager/approver coupling, Routine references, Stock display, audit, LINE,
  and outbox boundaries;
- run architecture, lint, typecheck, tests, check/build, and the relevant
  MySQL integration tests after source migration.

F3 does not authorize a behavior or API redesign; any such change requires a
separate request and compatibility plan.

## 23. Test and consumer inventory

### Employee-specific tests

```text
__tests__/api/employees-routes.test.ts
__tests__/components/EmployeeTable.test.tsx
__tests__/components/EmployeeTablePrimitives.test.ts
__tests__/helpers/employee-helpers.test.ts
__tests__/services/employee/import.test.ts
__tests__/services/employee/mutations.test.ts
__tests__/services/employee/queries.test.ts
__tests__/validations/employee.test.ts
__tests__/integration/signup-employee-concurrency.integration.test.ts
```

`__tests__/helpers/csv-helpers.test.ts` is mixed Employee/Leave CSV coverage
and must be split by ownership during F1/F3 rather than moved wholesale.

### Auth/workforce and cross-feature tests that protect Employee behavior

```text
__tests__/api/auth-signup-route.test.ts
__tests__/api/hybrid-login-route.test.ts
__tests__/api/hybrid-auth-routes.test.ts
__tests__/auth/hybrid-critical-flow.test.ts
__tests__/auth/workforce.test.ts
__tests__/auth/workforce-transaction.test.ts
__tests__/auth/liff.test.ts
__tests__/auth/liff-capabilities.test.ts
__tests__/lib/server-auth-token-version.test.ts
__tests__/lib/app-line-notification.test.ts
__tests__/lib/line-liff-session.test.ts
__tests__/services/audit-log/queries.test.ts
__tests__/audit-log-display.test.ts
```

Leave, Routine, and Stock API/application/integration tests also reference
Employee IDs, lifecycle, names, departments, managers, or linked users. The
repository-wide search identified these suites in addition to their module
tests:

```text
__tests__/api/leave-*.test.ts
__tests__/api/routine*.test.ts
__tests__/api/stock-requests-routes.test.ts
__tests__/integration/leave-*.test.ts
__tests__/integration/routine-*.test.ts
modules/leave/**/__tests__ and *.test.*
modules/routine/**/__tests__ and *.test.*
modules/stock/**/__tests__ and *.test.*
```

The exact module test files remain owned by their respective features. F1/F3
must use them as regression evidence instead of relocating them into Employee.

## 24. Unresolved risks and questions for implementation

These are concrete implementation questions, not unknown ownership:

1. **Combined lifecycle canonicalization:** `hasEligibleEmployeeLifecycle(null)`
   intentionally permits an unlinked User through some low-level Auth paths,
   while API/Workforce/LIFF paths require a linked active Employee. F1 must
   preserve and test each distinction before introducing a shared adapter.
2. **Hierarchy transaction seam:** Leave currently mutates the Employee-owned
   `managerId` while enforcing Leave-specific approver rules. The seam must
   retain atomicity and prevent races with Leave request creation and
   reassignment.
3. **Department future owner:** Department should become a separate
   organization/reference-data capability, but no current module exists. Avoid
   creating one as part of Employee migration without a separate scope.
4. **Backed-user display ownership:** Decide whether the fallback projection is
   a neutral Auth/platform helper or a deliberately safe Employee identity
   contract. This decision controls audit/Stock/Routine/Leave client graph
   imports.
5. **Mixed CSV helper:** Employee import and Leave report CSV helpers share one
   legacy file, and the runtime Prisma enum makes it unsafe as a generic client
   dependency. Split before F2 enforcement.
6. **List/stats inconsistency:** List/export exclude soft-deleted/bootstrap
   records, while stats counts do not. The UI also renders fewer stats than the
   API returns. Preserve first; decide any correction separately.
7. **Validation duplication:** Create schema, update schema, service, import,
   and Prisma each enforce different portions of email/status/department
   behavior. F1 needs characterization tests before consolidating.
8. **Import guarantees:** Import is partial-success, independently committed,
   has no observed audit event, and accepts unvalidated JSON rows at the HTTP
   boundary. These are compatibility facts and future hardening decisions.
9. **Export permission:** Employee export currently allows any authenticated
   API session. Do not infer admin-only behavior from the UI button.
10. **Prisma/runtime leakage:** Runtime Prisma imports and raw payloads must be
    kept out of the client entry and public domain contracts.
11. **Cross-module query shape:** Leave and Routine have transaction-sensitive
    Employee reads. Do not replace them with per-row module calls or a generic
    service that creates N+1 behavior without evidence.
12. **Orphaned legacy code:** `useCSVImport`, `EditStatusModal`, stale API types,
    and old UI constants need a consumer proof before deletion.
13. **Account consistency:** `User.employeeId` and the inverse Employee.user
    relation must remain one-to-one; signup and lifecycle mutations require
    their current locks and unique constraints.

## 25. F0 conclusion

F0 changes documentation only. No Employee implementation was moved, no
`modules/employee/` placeholder was created, and no runtime behavior, API
contract, authorization, signup/session/workforce rule, UI/UX, Leave/Routine/
Stock behavior, Prisma schema, migration, or database semantics were changed.

The next authorized implementation step is F1, using this document as the
behavior-preservation and public-boundary contract.

Phase F0 CLOSED — Employee boundary defined; implementation has not started.
