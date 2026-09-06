# Employee migration

Status: Phase F3 CLOSED — Employee migration complete; Phase G1 Department
server/persistence ownership complete; Phase G2 Department server-only
presentation boundary confirmed.

Approved F0 baseline: `ee9a60be6c077055873214a9644384caa8b43f80`
(`docs(employee): correct F0 migration boundary`).

This document retains the F0 discovery record and records the implemented
F1-F3 ownership and cleanup. All phases are behavior-preserving: API
contracts, permissions, transactions, concurrency rules, Thai wording, CSV
behavior, audit behavior, Auth/Workforce behavior, Leave behavior, UI, and
Prisma schema remain unchanged.

Phase G1's Department ownership seam is recorded here because Employee import
consumes it: `modules/employee/application/import-employees.ts` uses the public
`@/modules/department` reference query, while Employee persistence owns only
Employee identity lookup and Employee creation. The permanent single-NHF
product decision and complete Department record are maintained in
[organization-department-migration.md](./organization-department-migration.md).
G2 re-audited the Employee Department presentation boundary and confirmed that
Employee remains the owner of its selectors, import presentation, and
Department-specific display compatibility; no Department client entry is
required.

## F1 implementation record

Authoritative Employee server/business ownership is now:

```text
modules/employee/
├── application/
│   ├── constants.ts
│   ├── hierarchy.ts
│   ├── import-employees.ts
│   ├── mutations.ts
│   ├── signup-employee.ts
│   └── types.ts
├── domain/
│   ├── identity.ts
│   ├── import-status.ts
│   └── lifecycle.ts
├── infrastructure/
│   ├── export/employee-export.ts
│   └── persistence/
│       ├── employee-import.ts
│       └── employee-queries.ts
├── schemas/employee.ts
├── client.ts
└── index.ts
```

`index.ts` is the deliberate server/application interface. Route consumers use
the Employee schemas, list/create/update/delete/stats/import/export contracts,
the import row limit, and Employee display identity. Auth consumers use the
Employee-only lifecycle predicate plus the signup lookup and transaction-aware
lock/re-read contract. Employee also exposes the structural
`EmployeeOffboardingDependencyProvider`; it contains only the blocker fields
needed for the existing Employee error message and does not mention Leave
implementation types. The Employee route composition imports both public
module APIs and binds the Leave blocker implementation to that port. Leave uses
only the transaction-aware Employee hierarchy mutation contract.
`getEmployeeById` was not migrated because it has no production consumer and is
not exported.

The old `lib/services/employee/**` implementation was removed because no
production compatibility consumer remained. The former
`lib/validations/employee.ts` server-schema facade was also removed after a
repository-wide search confirmed that no runtime/production consumer remained.
Employee API routes now import their schemas from `@/modules/employee`; the
browser client entry does not expose server schemas. F2 moved the active forms
to the module's local schemas.

At the F2 boundary, the mixed `lib/helpers/employee-helpers.ts` still served
Auth, audit, Leave, Routine, and Stock consumers. The migrated Employee
presentation used its local client-safe formatter and Employee-owned browser
contracts; it did not route the broad legacy helper graph through the client
entry. F3 subsequently moved those consumers to deliberate owners and deleted
the mixed helper.

Employee lifecycle orchestration remains one serializable transaction. It
locks the Employee, delegates linked-account locking, self-offboarding and
last-active-ADMIN safety, User activation/deactivation, token-version changes,
identity synchronization, and refresh-token revocation to
`lib/auth/employee-account-lifecycle.ts`, then commits Employee state and audit
in the same transaction. Auth credential, password, cookie, token issuance,
rate-limit, and login behavior remain outside Employee.

Leave owns the semantic blocker query through
`getEmployeeLeaveOffboardingBlockers`. The Employee lifecycle accepts an
Employee-owned `EmployeeOffboardingDependencyProvider`; the
`app/api/employees/[id]/route.ts` composition boundary passes the real Leave
implementation for both status-changing PATCH requests and DELETE. Employee
invokes that provider with the exact `Prisma.TransactionClient` received by its
serializable lifecycle transaction, so the blocker read remains inside the
same transaction and no check/commit TOCTOU gap is introduced. Leave approver
assignment retains its Leave-specific rules, locks, audit meaning, and
serializable transaction; only the final `managerId` write crosses the public
Employee hierarchy interface using that same transaction.

Signup remains Auth-owned. It now uses Employee-owned exact-email lookup and
transaction-aware Employee lock/re-read eligibility. User creation, role
assignment, password hashing, unique-race mapping, audit, and session behavior
remain in Auth; the existing serializable transaction and row lock are
preserved.

Employee import row semantics and partial-success orchestration are module
owned, with each successful row still independently committed. The HTTP route
and active browser continue to reject more than 1,000 rows; the application
use case intentionally retains the legacy service's lack of an additional
row-count guard. Employee export owns filters, the 2,000-row limit, 250-row
batches, ordering, Thai headings/status labels, temporary-email rendering, and
filename construction; generic CSV streaming and HTTP audit scheduling remain
platform/delivery concerns. Export remains available to any authenticated API
session.

Employee implementation tests for schemas, queries, mutations, import, stats,
and export are colocated under `modules/employee/**`. External route, Auth,
signup concurrency, and Leave concurrency tests remain with their owning
layers/features. F2 also moved the Employee table/mobile tests and added
client CSV/parser and route-boundary coverage. Architecture enforcement now
covers Employee route ownership, deep imports, self-public-barrel imports,
client/server graphs, shared module direction, and the global Outbox Processor
prohibition.

## F2 implementation record

Phase F2 CLOSED — Employee presentation ownership migrated.

The active Employee browser/dashboard presentation is now owned by
`modules/employee/presentation/**`:

```text
modules/employee/presentation/
├── dashboard/
│   ├── EmployeeManagementSection.tsx
│   ├── AddEmployeeSection.tsx
│   ├── EmployeeList.tsx
│   ├── EmployeeMobileCard.tsx
│   ├── EmployeeModals.tsx
│   ├── EmployeeSearchControls.tsx
│   ├── EmployeeSkeletons.tsx
│   ├── EmployeeStatsCards.tsx
│   ├── EmployeeTable.tsx
│   ├── EmployeeTablePrimitives.tsx
│   ├── formatters.ts
│   ├── types.ts
│   ├── context/
│   ├── add-employee/
│   ├── edit-employee/
│   └── shared/
└── import/
    ├── ImportEmployeeRouteContent.tsx
    ├── ImportEmployeeCSV.tsx
    ├── ImportHeader.tsx
    ├── PreviewStep.tsx
    ├── ProgressSteps.tsx
    ├── ResultStep.tsx
    ├── UploadStep.tsx
    ├── csv.ts
    ├── types.ts
    └── useImportCSV.ts
```

The four Employee Dashboard routes compose through the browser-safe
`@/modules/employee/client` entry. Its route-facing presentation exports are
`EmployeeManagementSection`, `EmployeeManagementSectionSkeleton`,
`AddEmployeeSection`, and `ImportEmployeeRouteContent`. The Employee provider,
contexts, table/mobile components, form hooks, and import steps remain internal
to the presentation graph. Server schemas are exported only from
`modules/employee/index.ts` for API/application consumers and are intentionally
absent from `modules/employee/client.ts`.

Employee presentation state remains feature-owned: `EmployeeProvider`, list and
stats SWR state, filters, pagination, modal state, export state, and mutation
refresh behavior moved with the feature. Generic Dashboard shell, navigation,
session/access checks, loading feedback, and generic Dashboard contexts remain
owned by the app/Dashboard composition layer. Browser traffic still uses the
existing `/api/employees/**` and `/api/departments` endpoints.

The active Employee CSV browser flow now uses the local client-safe
`presentation/import/csv.ts` implementation. It preserves BOM handling, Thai
and English aliases, required fields, source rows, quoted values, optional
blanks, sample CSV content/name, Thai errors, status mapping, the 5 MB file
limit, 1,000-row limit, preview, partial-success results, and the existing
HTTP import endpoint. It no longer reaches the mixed Prisma/Leave
`lib/helpers/csv-helpers.ts`. That helper was still present at the F2 boundary
for confirmed compatibility consumers and was deleted after F3 moved the
remaining Leave report behavior.

F2 did not change Employee server/business ownership, lifecycle/offboarding
composition, API URLs/contracts, permissions, database schema, or UI behavior.

## F3 implementation record

Phase F3 CLOSED — Employee compatibility cleanup and final re-audit complete.

Approved F3 baseline: `72fb23d2a6e436d21694c3a0e2534f3a827e143f`
(`fix(employee): remove unused validation facade`). The repository-wide audit
classified every production consumer of the legacy Employee paths and public
contracts as Employee, Auth/Workforce, Leave, Routine, Stock, Audit/Platform,
LINE/LIFF, generic shared, test-only, or orphan. Legacy paths were removed
only after the production search, relative/barrel/dynamic/`require()` search,
mock-path search, typecheck, architecture checks, and focused behavioral tests
agreed that no active runtime consumer remained.

The confirmed orphan and compatibility files removed in F3 are:

```text
hooks/useCSVImport.ts
components/employee/EditStatusModal.tsx
types/employees.ts
constants/employees.ts
lib/helpers/employee-helpers.ts
lib/helpers/csv-helpers.ts
__tests__/helpers/employee-helpers.test.ts
```

Ownership after cleanup is explicit:

| Concern | Final owner |
| --- | --- |
| Pure Employee identity (`getEmployeeFullName`, `getEmployeeDisplayName`) | `modules/employee/domain/identity.ts`, consumed through the Employee server root or the proven pure client export |
| Employee status values/labels and presentation styling | Employee domain and `modules/employee/presentation/dashboard/formatters.ts`; no global Employee status facade remains |
| Employee CSV parsing and browser import behavior | `modules/employee/presentation/import/csv.ts` and the Employee presentation graph |
| Generic User/Employee display fallback | `shared/identity/display.ts` as the structural, browser-safe `getUserDisplayName`; exact order remains Employee identity, `User.name`, `User.email`, caller fallback |
| Leave CSV/report labels and row mapping | `modules/leave/infrastructure/reports/`; no Leave behavior is exposed through the Employee API |
| Mixed `types/api.ts` | Unrelated Email/Stock/LINE contracts remain; obsolete Employee response declarations were removed only |

The Employee server and client entries were re-audited against production
consumers. `modules/employee/client.ts` remains browser-safe and exports only
the four Employee route compositions plus `getEmployeeDisplayName`. No
schemas, hooks, contexts, CSV parser, lifecycle logic, repositories, Prisma,
or server application/infrastructure are exposed through that entry. The
architecture checker now rejects every deleted Employee compatibility path,
including alias and relative forms and the import forms handled by the parser.
It also continues to enforce Employee route ownership, client/server graph
separation, Employee-internal local contracts, Employee → Leave prohibition,
and the global Outbox Processor boundary.

The final re-audit covered Auth/Workforce and signup locking, Leave manager and
offboarding transactions, Routine owner/display behavior, Stock requester and
issuer display, audit presentation, LINE/LIFF identity projection, and the
absence of Employee runtime imports of Leave. No API, permission, DB schema,
transaction, concurrency, Thai wording, CSV, audit, LINE/LIFF, or UI behavior
was intentionally changed.

## 1. Executive boundary decisions

| Concern | F0 owner decision | Reason and current evidence |
| --- | --- | --- |
| Employee profile and organizational data | Employee | `Employee` owns names, contact fields, position, affiliation, department relation, email, and employee status. The current CRUD, list, stats, import, and export behavior all operate on these concepts. |
| Employee lifecycle transition | Employee | Employee owns `Employee.status`, `Employee.deletedAt`, profile state, hierarchy, and whether the target has active organizational subordinates. The legacy lifecycle function also coordinates account safety/effects and Leave blockers, but those policies do not become Employee-owned merely because Employee orchestrates the administration action. |
| User credentials, account administration, and authentication | Auth/platform | `User.isActive`, `User.deletedAt`, `User.role`, token versions, refresh-token revocation, last-active-ADMIN protection, self-account/offboarding protection, password hashing, login, cookies, session families, CSRF/trusted mutations, and auth rate limits are account/security concerns. They are not pure Employee domain invariants. |
| Account-to-workforce eligibility | Existing Auth/Workforce boundary | `lib/auth/workforce.ts` and `workforce-transaction.ts` already combine User and Employee state. F0 does not create a new Workforce module. Employee should expose only Employee-side lifecycle/identity contracts; Auth/Workforce should compose them with User/session state. |
| Employee hierarchy | Employee | `managerId`, the self-relation, subordinate lookup, and the meaning of who reports to whom are organizational structure. Leave may interpret that structure for approval, but does not own the underlying relationship. |
| Leave approval and exception policy | Leave | `approverId`, `exceptionApproverId`, reassignment rules, pending-request guards, current-action resolution, and approval capabilities are Leave rules. They must not be moved into Employee. |
| Leave offboarding dependency policy | Leave | Leave owns the semantic interpretation of which outstanding request/action states prevent an Employee from leaving Leave responsibilities. Its implementation is injected into the Employee lifecycle through `EmployeeOffboardingDependencyProvider`; Employee does not reconstruct the policy from `LeaveRequest`. |
| Department reference data | `modules/department/` server capability | Department owns reference identity, server queries, and Prisma persistence. Employee owns its `departmentId` association and import mapping, and consumes the narrow public Department reference query. |
| Display identity | Split by meaning | Employee owns Employee display projection and pure Employee formatting. The fallback projection from a User to Employee/name/email is an Auth/workforce/platform composition concern and must not make generic client code import the Employee server barrel. |
| CSV import/export | Employee | The business meaning of Employee rows, fields, normalization, status, department mapping, and report columns is Employee-owned. CSV parsing/streaming is a technical adapter and may use shared file/HTTP primitives. |
| Audit, LINE, outbox, email, and session mechanics | Shared/platform or delivery | These systems deliver or record events. Employee supplies Employee event meaning/snapshots and identity data; it must not own the global outbox processor, LINE token/session implementation, or generic audit infrastructure. |

The source-of-truth rule for F1 is therefore:

> Employee owns the Employee lifecycle transition.
>
> Auth/platform owns account/session security mechanics.
>
> Leave owns whether outstanding Leave responsibility blocks that transition.
>
> Employee may orchestrate the operation, but it must consume those external
> policies through deliberate contracts rather than duplicating their business
> rules.

Employee lifecycle orchestration may request account deactivation/reactivation,
but Auth/platform owns authentication/session mechanics and account-security
effects. Auth/Workforce continues to own whether an authenticated account may
act as workforce.

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
| `app/api/employees/import/route.ts` | Admin JSON import submission and 1,000-row guard | `EMPLOYEE DELIVERY/HTTP` | Thin route adapter in F1; browser file parsing is now owned by Employee presentation in F2 |
| `app/api/employees/export/route.ts` | Authenticated streamed Employee CSV export | `EMPLOYEE DELIVERY/HTTP` | Thin route adapter in F1 over Employee report/export contracts |
| `app/api/departments/route.ts` | Authenticated Department reference-data read | App delivery composed over `@/modules/department` | G1 preserves the URL/auth/403/response/order/sanitized-error contract while Department owns persistence |
| `lib/ssot/routes.ts` | Canonical Employee dashboard/API route constants, including detail, stats, import, export, and departments | `SHARED / PLATFORM` route SSOT with Employee-specific constants | Compatibility route contract; F1/F2 preserve values |
| `lib/ssot/exports.ts` | Employee export limit of 2,000 rows and batch size of 250 | `SHARED / PLATFORM` policy registry with Employee-specific entry | F2 presentation continues to consume the existing registry; any ownership cleanup remains separately scoped |

There is no Employee detail `GET /api/employees/[id]` route in the current
inventory. The `[id]` route contains `PATCH` and `DELETE` only.

### 3.2 Dashboard route composition

| Current path | Observed responsibility | Classification | Target slice |
| --- | --- | --- | --- |
| `app/dashboard/employees/page.tsx` | Employee management route composition; Suspense boundary | Next.js delivery using Employee client entry | F2 complete through `@/modules/employee/client` |
| `app/dashboard/employees/loading.tsx` | Employee management skeleton route | Next.js delivery using Employee client entry | F2 complete through `@/modules/employee/client` |
| `app/dashboard/employees/new/page.tsx` | Admin gate and Add Employee route composition | Employee client entry plus delivery | F2 complete; preserve `requireDashboardAdmin` behavior |
| `app/dashboard/employees/new/loading.tsx` | Loading UI for Add Employee | Generic Dashboard delivery feedback | Remains outside Employee; F2 does not move generic skeletons |
| `app/dashboard/employees/import/page.tsx` | Admin gate and import route composition | Employee client entry plus delivery | F2 complete; preserve `requireDashboardAdmin` behavior |
| `app/dashboard/employees/import/loading.tsx` | Loading UI for import | Generic Dashboard delivery feedback | Remains outside Employee; F2 does not move generic skeletons |
| `modules/employee/presentation/import/ImportEmployeeRouteContent.tsx` | Client import route content, Dashboard navigation, SWR invalidation, and `ImportEmployeeCSV` composition | Employee presentation with Dashboard/platform dependency | F2 complete; keep Dashboard shell/navigation outside Employee |

The route URLs are canonical App Router paths and are not to be changed by the
migration.

### 3.3 Employee feature components and context

The following files are the active Employee-specific presentation after F2:

```text
modules/employee/presentation/dashboard/EmployeeManagementSection.tsx
modules/employee/presentation/dashboard/AddEmployeeSection.tsx

modules/employee/presentation/dashboard/context/EmployeeContext.tsx
modules/employee/presentation/dashboard/context/EmployeeProvider.tsx
modules/employee/presentation/dashboard/context/types.ts

modules/employee/presentation/dashboard/EmployeeList.tsx
modules/employee/presentation/dashboard/EmployeeTable.tsx
modules/employee/presentation/dashboard/EmployeeTablePrimitives.tsx
modules/employee/presentation/dashboard/EmployeeMobileCard.tsx
modules/employee/presentation/dashboard/EmployeeSearchControls.tsx
modules/employee/presentation/dashboard/EmployeeModals.tsx
modules/employee/presentation/dashboard/EmployeeStatsCards.tsx
modules/employee/presentation/dashboard/EmployeeSkeletons.tsx
modules/employee/presentation/dashboard/formatters.ts
modules/employee/presentation/dashboard/types.ts

modules/employee/presentation/dashboard/add-employee/AddEmployeeForm.tsx
modules/employee/presentation/dashboard/add-employee/useAddEmployee.ts

modules/employee/presentation/dashboard/edit-employee/EditEmployeeForm.tsx
modules/employee/presentation/dashboard/edit-employee/useEditEmployee.ts

modules/employee/presentation/import/ImportEmployeeCSV.tsx
modules/employee/presentation/import/ImportHeader.tsx
modules/employee/presentation/import/ProgressSteps.tsx
modules/employee/presentation/import/UploadStep.tsx
modules/employee/presentation/import/PreviewStep.tsx
modules/employee/presentation/import/ResultStep.tsx
modules/employee/presentation/import/useImportCSV.ts
modules/employee/presentation/import/csv.ts
modules/employee/presentation/import/types.ts

modules/employee/presentation/dashboard/shared/EmployeeFormFields.tsx
modules/employee/presentation/dashboard/shared/types.ts
```

`EmployeeProvider` is a feature application/presentation state provider, not a
generic Dashboard workforce provider. It owns Employee list/stats SWR state,
search/filter/page state, edit-modal state, export state, refresh/revalidation,
and Employee mutation toasts. It now lives under
`modules/employee/presentation/dashboard/context/`. The Dashboard UI/data
contexts used by the provider remain Dashboard/platform dependencies.

The former `components/employee/EditStatusModal.tsx` was confirmed to have no
production consumer and was removed in F3. Its duplicate status-editing
behavior was not migrated because the active Employee presentation already
owns status editing.

### 3.4 Historical pre-F3 legacy inventory

The following inventory was captured before F3 cleanup. It is retained as a
historical discovery record; the final ownership and deletion decisions are in
the F3 implementation record above.

```text
lib/services/employee/constants.ts
lib/services/employee/import.ts
lib/services/employee/index.ts
lib/services/employee/mutations.ts
lib/services/employee/queries.ts
lib/services/employee/types.ts

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

Pre-F3 classification and final outcome:

| Area | Pre-F3 classification | Final outcome |
| --- | --- | --- |
| `lib/services/employee/queries.ts` | `EMPLOYEE INFRASTRUCTURE` plus application query behavior | Employee application query contracts backed by Employee infrastructure |
| `lib/services/employee/mutations.ts` | `EMPLOYEE APPLICATION` plus Prisma/transaction implementation | Employee lifecycle/profile application use cases; Auth/session side effects use a platform port |
| `lib/services/employee/import.ts` | `EMPLOYEE APPLICATION` plus persistence | Employee import use case with a technical CSV/persistence adapter |
| `lib/services/employee/types.ts` | Mixed service DTO, actor, persistence-derived type, and result contracts | Split into domain/reference types, application commands/results, and route DTOs; do not create a mega type file |
| `lib/services/employee/constants.ts` | Employee query/import policy | Employee module policy/constants |
| `modules/employee/schemas/employee.ts` | Employee route schemas and inferred input types | Employee-owned server schema source, exported through `modules/employee/index.ts` only |
| `lib/helpers/employee-helpers.ts` | Mixed Employee semantics, identity projection, presentation formatting, and User fallback | Removed in F3 after cross-feature consumers moved to deliberate Employee client/server or neutral shared contracts |
| `lib/helpers/csv-helpers.ts` | Mixed Employee CSV and Leave CSV implementation; runtime Prisma enum import | Removed in F3; Employee parsing is module-owned and Leave report labels are Leave-owned |
| `lib/helpers/file-validation.ts` | Generic file validation with current CSV-specific implementation | Shared/platform primitive if it remains generic; Employee import owns which file policy it applies |
| `types/employees.ts` | Legacy combined domain/API/UI/CSV types | Removed in F3; active Employee code uses module-local contracts |
| `types/api.ts` | Legacy API types; `GetEmployeesResponse` did not match the current paginated response | Unrelated Email/Stock/LINE contracts retained; obsolete Employee declarations removed in F3 |
| `constants/employees.ts` | Employee status values, labels, colors, icons, descriptions | Removed in F3; active status contracts are Employee domain/presentation-local |
| `constants/ui.ts` | Generic UI constants with Employee CSV/status/pagination entries; some entries are stale | Compatibility/legacy; do not move the whole file into Employee |
| `hooks/useCSVImport.ts` | Older duplicate CSV hook with no production consumer found | Removed in F3 after the final production-consumer audit |
| `constants/audit.ts` | Shared audit labels/entity labels for Employee events and `EmployeeApprover` | Audit/platform registry; Employee event meaning remains Employee/Leave respectively |
| `constants/dashboard.ts` | Dashboard menu/tab entries and route composition for Employee screens | Dashboard delivery/platform; keep route visibility separate from authorization |
| `app/globals.css` | Global Employee dashboard/action/nickname design tokens | Shared global styling; keep tokens global unless a later design-system change explicitly scopes them |
| `components/dashboard/context/index.ts` | Generic Dashboard context barrel; Employee re-exports removed in F2 | Dashboard-only compatibility barrel; Employee provider/context are module-owned |
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
| `app/api/employees/**` | Server delivery | `@/modules/employee` schemas, use cases, import/export, and identity contracts | Audit event and shared HTTP/CSV response | Employee/User/Department Prisma; API/Admin auth; audit platform | `__tests__/api/employees-routes.test.ts` |
| `app/dashboard/employees/**` | Server route + client content | `@/modules/employee/client` plus generic API/SWR adapters | Module-owned Employee components, forms, import flow, Department endpoint, Dashboard context | Dashboard auth/navigation; Employee API; browser-only state | Module presentation tests and architecture route tests |
| `modules/employee/presentation/**` | Client | Local Employee types/formatters/schemas, API adapters, client CSV parser | Provider → list/table/forms/import steps → Employee API | Dashboard UI/data context; no direct Prisma in client graph | `modules/employee/presentation/**` tests |
| `lib/auth/**`, `app/api/auth/**` | Server | User queries inspect Employee status/deleted/link/name; signup locks Employee | API session, LIFF identity, hybrid auth, Workforce gate | Auth owns credentials/session; Employee/User/Department DB; Leave public capability API | Auth, signup, hybrid, workforce, LIFF, token-version tests |
| `modules/leave/**` | Server + client | Leave-owned persistence queries select Employee; server identity uses `@/modules/employee`, browser identity uses `@/modules/employee/client` | Requester/approver display, report rows, notification payloads, session capability projection | Leave owns approval/exception rules; Employee supplies identity/status/hierarchy data | Leave unit/API/integration suites and concurrency tests |
| `modules/routine/**` | Server + client | Routine queries/mutations/import/recipients select Employee or linked User data; identity uses Employee public entries and shared display projection | Assignee display, active/readiness projection, owner mapping, notifications | Routine owns assignee/import/recipient rules; Employee supplies reference data | Routine API/application/integration suites |
| `modules/stock/**` | Server + client | Stock queries/persistence/reports select `User.employee` display fields; generic fallback uses `shared/identity/display.ts` | Requester/issuer display in notifications, reports, LIFF/UI | Stock owns inventory/request/report rules; shared structural helper preserves fallback precedence | Stock API/application/integration suites |
| Audit | Shared server + client display | Audit query/display reads Employee names through `@/modules/employee/client`; generic User fallback uses `shared/identity/display.ts` | Generic audit viewer preserves field labels, names, and fallback behavior | Audit infrastructure/platform; Employee event meaning; client boundary enforced | `__tests__/audit-log-display.test.ts`, audit query tests |
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
| `GET /api/departments` | `requireApiSession`; current route uses a custom `403` unauthorized response | No parameters | Success `{ departments }`; unexpected failure `500` | Delegates to `listDepartments()` through `@/modules/department`, which owns the name-ascending Department query. Employee forms/import continue to consume the browser endpoint. |

There is no observed Employee-specific request body-size guard or rate limit in
these routes. The active client and HTTP route independently enforce the import
row cap; the legacy import service does not. The browser-side five-megabyte file
policy is the other current import control. F1 must preserve this effective
external behavior and separately record any hardening proposal rather than
silently changing the contract.

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

The current Employee lifecycle application accepts `OFFBOARD`, `SUSPEND`, and
`REACTIVATE` and uses row locks plus a serializable transaction. It coordinates
Employee lifecycle/hierarchy checks, Auth/account-administration safety and
effects, and the injected Leave responsibility port:

| Operation | Employee write | User/session write | Guards and audit |
| --- | --- | --- | --- |
| Offboard / `DELETE` | `status = INACTIVE`, `deletedAt = now` | linked User `isActive = false`; token version increments; non-revoked refresh tokens are revoked | Blocks self-offboarding, removing the last active admin, targets with active subordinates, or targets with relevant pending/approved Leave action dependencies; records Employee delete audit |
| Suspend | `status = SUSPENDED`, `deletedAt` remains `null` | linked User `isActive = false`; token version increments; refresh tokens are revoked | Uses the same deactivation safety checks; records status-change audit |
| Reactivate | `status = ACTIVE`, `deletedAt = null` | linked User `isActive = true`, `deletedAt = null`; token version increments; refresh tokens are revoked | Re-enables the Employee/account pair and records status-change audit |

The Leave blocker provider queries `LeaveRequest` and treats `PENDING`,
`CANCELLATION_REQUESTED`, and `APPROVED` with non-null
`notTakenRequestedAt`—for either `approverId` or `exceptionApproverId`—as
blockers. It receives the same transaction client as the Employee lifecycle.
Those meanings are current compatibility behavior, but their semantic owner is
Leave. Self-account/offboarding and last-active-ADMIN protection are
Auth/account-administration concerns; active subordinate protection is an
Employee hierarchy concern.

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
- F1 provides a deliberate seam for changing the Employee-owned hierarchy
  relation while allowing Leave to retain its Leave-specific preconditions and
  transaction semantics. It does not move the whole Leave approver assignment
  use case into Employee.

#### Duplicate and validation locations

| Rule | Current location(s) | F0 finding |
| --- | --- | --- |
| Required names/position/department ID | `modules/employee/schemas/employee.ts`, UI forms | Route and client schema behavior must be preserved; import has a separate required-field path |
| Email syntax and organization domain | Zod route schema, Employee service, import service | Domain enforcement is duplicated and differs between create schema/service/import; document before consolidating in F1 |
| Employee email uniqueness | Service query, serializable update transaction, Prisma unique constraint | Keep both application feedback and DB race protection |
| User email uniqueness/synchronization | Profile update transaction, signup transaction, Prisma unique constraint | Cross-aggregate behavior requires an explicit Auth/platform integration seam |
| Department validity | Prisma foreign key, Employee form lookup, import code/name mapping | Import and form semantics are not identical to a generic Department API |
| Status values | Prisma enum, validation schema, constants, CSV parser | Future domain value must not leak Prisma runtime types to clients |
| Manager/hierarchy safety | Leave approver assignment and Employee lifecycle guards | Employee hierarchy command is the write seam; Leave retains approver policy and Employee lifecycle consumes its blocker provider |

## 5. Import workflow audit

Employee import is a distinct Employee sub-capability. Its current behavior is:

### Input and file policy

Current compatibility behavior:

- The browser accepts `.csv` only, with a maximum file size of five megabytes.
  Empty MIME type is allowed; known CSV MIME types are accepted. A basic
  signature/null-byte check rejects common binary signatures, including ZIP
  (therefore XLSX), PDF, PNG, JPEG, EXE, and ELF.
- Employee import does not accept `.xls` or `.xlsx`. The repository's XLSX
  import behavior belongs to Routine and must not be copied into Employee by
  assumption.
- The active client at
  `modules/employee/presentation/import/useImportCSV.ts` previews up to the first 100
  parsed rows and rejects more than 1,000 parsed rows before posting.
- `app/api/employees/import/route.ts` independently rejects more than 1,000
  submitted rows.
- `modules/employee/application/import-employees.ts` retains the application
  use case's lack of an additional row-count guard.
- `app/api/employees/import/route.ts` remains the server boundary that checks
  the 1,000-row maximum before invoking the Employee application contract.
- The server endpoint receives JSON rows, not the original file. It only checks
  that `employees` is an array; it does not re-run a row schema at the route
  boundary.

### Columns and parsing

`modules/employee/presentation/import/csv.ts` maps Thai and English aliases for
first name, last name, email, phone, position, department, affiliation,
nickname, and status. Required columns are first name, last name, position, and
department. The parser
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
route remains a thin adapter. F1 may centralize the 1,000-row invariant inside
the Employee application seam if external HTTP/client behavior remains
unchanged, but that is consolidation of the current duplicated client/route
enforcement, not preservation of an existing service-level check. The existing
behavior must be characterized by tests before any transaction or validation
consolidation.

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

The initial public Employee query contracts are `listEmployees`,
`getEmployeeStats`, and a pure filter/value contract because existing routes
consume them. `getEmployeeById` may remain an internal application/query
implementation, but it is not part of the initial public contract unless F1
discovers a real production consumer. Its service unit tests do not justify a
public export, and there is no current `GET /api/employees/[id]` route. The
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
  submit, and result/error display. It uses the Employee-owned client-safe CSV
  parser plus generic download/toast/SWR facilities.
- Employee dashboard pages use `requireDashboardAdmin` for new/import routes,
  while the main page is composed under the existing Dashboard session/layout.

### Context ownership decision

`modules/employee/presentation/dashboard/context/EmployeeContext.tsx` and
`EmployeeProvider.tsx` represent Employee feature state, not global workforce
identity or session state. Generic Dashboard navigation, UI messaging, and
session contexts stay outside Employee. The old dashboard Employee context
path is no longer used by production Employee routes.

### Browser adapters found

The feature continues to use the shared browser `apiGet`/`apiPost`/`apiPatch`,
route SSOT constants, SWR, toast, download, debounce, and file-validation
primitives from its module-owned presentation code. No Employee server
application API is exposed to the browser.

The Department lookup is intentionally still an HTTP concern of Employee
presentation: the add/edit hooks use `API_ROUTES.employees.departments`, which
resolves to `GET /api/departments`. The Employee presentation does not import
`@/modules/department`; the Department server entry is protected from direct
and transitive Client Component reachability by the architecture checker.

### Implemented presentation ownership

```text
modules/employee/presentation/dashboard/
  EmployeeManagementSection
  AddEmployeeSection
  EmployeeList, table/mobile/modals/search/stats/skeletons
  context/, add-employee/, edit-employee/, shared/
modules/employee/presentation/import/
  ImportEmployeeRouteContent
  ImportEmployeeCSV, step components, csv.ts, useImportCSV.ts
```

The important boundary is now implemented: feature UI, feature hooks, feature
context, client-safe types/formatters, and browser import parsing move together,
while `app/dashboard/employees/**` remains route composition and URL
compatibility through `@/modules/employee/client`.

## 9. Type, schema, and Prisma leakage audit

### Final type ownership map

| Type source | Contents after F3 | Final owner |
| --- | --- | --- |
| `modules/employee/application/types.ts` | Filters, create/update commands, import rows/errors/results, Employee-with-relations and pagination result, service actor | Employee application/reference contracts; persistence payloads remain behind the infrastructure boundary |
| `modules/employee/schemas/employee.ts` | Create/update/filter Zod schemas and inferred input types | Employee server/application schema source; derive input types from schemas |
| `modules/employee/presentation/dashboard/types.ts` | Employee/Department/User browser DTOs, form data, list/form props | Employee presentation-local client-safe contracts |
| `modules/employee/presentation/import/types.ts` | CSV data, import results, step/file/preview/result UI state | Employee presentation/import-local client-safe contracts |
| `types/employees.ts` | Legacy Employee/Department/User shapes, form data, CSV data, import results, table/modal props | Removed in F3; active Employee contracts are module-local |
| `types/api.ts` | Unrelated Email/Stock/LINE contracts after Employee declarations were removed | Retained only for its unrelated shared contracts; current Employee API DTOs remain module-owned |
| `modules/employee/presentation/dashboard/context/types.ts` | Provider/UI state and context values | Employee presentation-local types |
| `modules/employee/presentation/import/types.ts` | Import step/file/preview/result UI state | Employee presentation/import-local types |
| `modules/employee/presentation/dashboard/shared/types.ts` | Form field/presentation props | Employee presentation-local types |
| `@prisma/client` Employee/Department/User payloads | Persistence models and enum values | Infrastructure-only; map to Employee domain/reference/API types before public export |

### Prisma leakage

- No direct `@prisma/client` import was found in the Employee React component
  tree or Employee dashboard route components.
- Employee application types use the structural transaction port and
  Employee-owned status/reference contracts; Prisma payloads remain inside
  Employee infrastructure or explicit platform transaction types.
- The former `lib/helpers/csv-helpers.ts` imported `EmployeeStatus` as a runtime
  Prisma enum and mixed it with Leave CSV helpers. F3 removed the file; the
  Employee browser parser is owned by `modules/employee/presentation/import/csv.ts`
  and Leave report labels/mapping are owned by Leave report infrastructure.
- Validation and UI constants currently use string status values independently
  of Prisma, so a future module must have one domain status representation and
  explicit adapters rather than exporting a Prisma enum.
- Auth, Leave, Routine, and Stock server code may use typed Prisma projections
  internally, but those payloads must not become the Employee public API or be
  exported from `client.ts`.

## 10. Historical Employee helper ownership audit and final extraction

The deleted `lib/helpers/employee-helpers.ts` was mixed responsibility and was
not moved wholesale to `shared/`. Its exports were audited individually and
the final owners below are the contracts now used by production code.

| Export | Meaning/change owner | Recommendation | Real consumers found |
| --- | --- | --- | --- |
| `getEmployeeStatusLabel` | Employee status presentation vocabulary | Employee domain implementation plus Employee presentation-local re-export; not a global contract | Employee table/list/import/export |
| `getEmployeeStatusBadge` | Employee UI styling vocabulary | Employee presentation-local; not a server public API | Employee table/mobile status UI |
| `getEmployeeStatusInfo` | Employee status option metadata | Employee presentation-local only | No external production consumer after F2 |
| `getEmployeeStatusValueFromLabel` | Employee CSV/form label parsing | Employee import/presentation-local only | No external production consumer after F2 |
| `isEmployeeActive` | Employee status-only predicate | Employee domain/presentation-local, distinct from workforce eligibility | No external production consumer after F2 |
| `isEmployeeSuspended` | Employee status-only predicate | Employee domain/presentation-local | No external production consumer after F2 |
| `getEmployeeFullName` | Pure Employee identity formatting | Employee domain identity; server root export because signup and Routine server code consume it | `app/api/auth/signup/route.ts`, `modules/routine/application/imports/owner-mapping.ts` |
| `getEmployeeDisplayName` | Employee full name plus nickname | Employee domain identity; server root and browser-safe client exports | Leave/Routine server and browser presentation, audit display |
| `getEmployeeInitials` | Pure Employee presentation formatting | Employee presentation-local formatter | Employee avatar/table presentation |
| `getEmployeeEmailStatus` | Employee temporary/valid/invalid display classification | Employee domain implementation used by Employee export; not an Auth credential validator | `modules/employee/infrastructure/export/employee-export.ts` |
| `formatEmployeePhone` | Employee phone display formatting | Employee presentation-local | Employee dashboard/import presentation |
| `getEmployeeDepartmentLabel` | Current Employee/Department display mapping | Employee presentation-local until a reference-data module exists | Employee dashboard/import presentation |
| `getEmployeeDepartmentBadgeClass` | Current Employee/Department UI styling | Employee presentation-local | Employee dashboard/import presentation |
| `getEmployeeBackedUserDisplayName` | Composite User → Employee/name/email fallback identity projection | Removed; neutral structural `getUserDisplayName` in `shared/identity/display.ts` preserves the exact fallback order without depending on Employee | Auth server/LIFF, audit, Routine, Stock, notifications/reports |

The final fallback helper is not an Employee domain formatter: it decides
account identity composition between a linked Employee projection, `User.name`,
`User.email`, and a caller fallback. Its neutral structural owner keeps Auth,
Stock, Routine, audit, and LIFF code from depending on the Employee server
barrel merely to render a user name.

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

The legacy Employee deactivation guard was a second transitional dependency in
the opposite direction: it directly queried `LeaveRequest.approverId`,
`exceptionApproverId`, `status`, and `notTakenRequestedAt` to decide whether
outstanding Leave responsibility blocked an Employee lifecycle transition. The
corrective pass removes that runtime dependency. Employee now consumes only
the structural port, and Leave remains responsible for interpreting those
workflow states.

The corrected F1 dependency direction is:

```text
app/api/employees/[id]/route.ts (composition boundary)
    |
    +--> @/modules/employee
    |       |
    |       +--> Employee lifecycle / hierarchy invariants
    |       |       depends on EmployeeOffboardingDependencyProvider
    |       +--> Auth/account safety + account/session side effects
    |
    +--> @/modules/leave
            +--> getEmployeeLeaveOffboardingBlockers (provider adapter)

@/modules/leave approver assignment
    +--> @/modules/employee hierarchy contract
```

The Leave public API provides `getEmployeeLeaveOffboardingBlockers` as the
adapter for the Employee-owned `EmployeeOffboardingDependencyProvider` port.
Employee does not import `@/modules/leave` or any Leave internal; the outer
composition boundary supplies the adapter. Leave owns the blocker semantics,
while Employee owns the high-level offboarding orchestration and formats the
structural result for its existing error message.

This must not become an ordinary detached query with weaker guarantees. The
provider receives the caller's `Prisma.TransactionClient` and executes before
any Employee/User lifecycle write, preserving the effective serializable
transaction and locking guarantees of the current lifecycle operation. Relevant
races include Leave request creation, approver reassignment, Leave action
changes, and Employee hierarchy changes.

The current Leave approver-assignment use case writes `Employee.managerId`
through the public Employee hierarchy seam. F1 preserves its transaction and
Leave-specific policy. Leave must not deep-import `modules/employee` internals,
and Employee must not absorb Leave approval policy.

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
where a real ownership contract benefits from it. Department's G1 reference
contract is now the proven cross-module seam for Employee import.

## 14. Department ownership decision

### F0 evidence (historical)

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

### Post-G0 product decision and G1 implementation

NHF Employee is permanently a single-NHF-organization system. There is no
Organization domain or tenant architecture, and the existing global Department
`name`/`code` uniqueness remains intentional.

Department is now an independent NHF-wide server capability in
`modules/department/`. Its public server entry exposes `listDepartments()` for
the app route and `listDepartmentReferences()` for Employee import. Department
infrastructure owns Department Prisma reads.

Employee continues to own:

- the fact that an Employee has a `departmentId` association;
- Employee form/import validation and the existing import aliases/mapping;
- Employee-specific display/report use of the relation; and
- Employee persistence, including duplicate identity lookup and creation.

Employee import consumes Department only through `@/modules/department`; it no
longer calls `prisma.department.findMany()` from Employee persistence. The route
remains app delivery and its URL, auth, 403, response, ordering, and sanitized
failure behavior remain unchanged. No Department client entry, CRUD, lifecycle,
hierarchy, or Department-head behavior was introduced.

G2 confirms that this server seam does not imply a Department presentation
seam. Employee continues to own the Department selector, `departmentId`
association input, import aliases/mapping, and Employee-facing labels/styles.
Auth/Dashboard, Leave, Routine, Stock, and Email Request retain their audited
projection, opaque transport, no-dependency, or free-text ownership decisions.

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

The implemented cross-boundary mutation is a narrow Employee hierarchy command
invoked by Leave's approver-assignment application use case. Leave retains its
preconditions, assignment meaning, audit details, and transaction/concurrency
behavior; Employee owns only the actual `managerId` write. It is not a generic
“Leave approver” API in Employee.

The other cross-module seam is deliberately inverted: Employee lifecycle
orchestration depends on its structural `EmployeeOffboardingDependencyProvider`
port, while the outer Employee route composition binds
`getEmployeeLeaveOffboardingBlockers` from Leave. The provider must use the
same lifecycle transaction client; Employee must not import the Leave module.

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
`lib/audit-log/display.ts`. The final display graph uses the pure Employee
formatter from `@/modules/employee/client` and the neutral structural
`getUserDisplayName` helper; it does not import the Employee server entry. The
completed Leave and Employee migrations demonstrate that a generic
client-reachable helper importing a server module entry can pull server-only
code into the client graph.

F3 applies the required Employee display split explicitly:

```text
client-safe pure Employee formatter -> modules/employee/client
route-facing Employee presentation -> @/modules/employee/client
server/application Employee use case -> @/modules/employee
generic User/Employee fallback -> shared/identity/display.ts
```

`getEmployeeBackedUserDisplayName` was eliminated. Its exact fallback behavior
is now covered by focused tests for `shared/identity/display.ts`.

### Other client-reachable risks

- The active Employee import presentation no longer reaches the deleted mixed
  `lib/helpers/csv-helpers.ts`; its parser is module-owned and Leave report
  labels/mapping are Leave-owned.
- Generic audit display, Stock/Routine/Leave client components, and Auth/LIFF
  now use deliberate Employee client/server identity contracts or the neutral
  structural display helper, according to graph and ownership context.
- Type-only Prisma imports may be erased safely, but runtime Prisma imports,
  filesystem/workbook/database adapters, and server application use cases must
  never be exported from `client.ts`.

### Guardrail timing

F3 extends the architecture checker with deleted Employee compatibility-path
guards. Employee Dashboard route composition, deep presentation import,
presentation self-barrel, browser-safe client graph, Employee → Leave, and
Outbox Processor rules remain enforced. The deleted-path guard normalizes alias
and relative forms and covers imports, re-exports, dynamic imports, `require`,
and test/mock paths handled by the parser.

## 18. Employee module shape

Employee is large enough to justify proportional domain, application,
infrastructure, presentation, and schema boundaries. F1/F2 now implement the
following proportional shape:

```text
modules/employee/
├── domain/
│   ├── lifecycle and Employee-only eligibility
│   ├── identity/reference value contracts
│   └── hierarchy invariants
├── application/
│   ├── employees/list, create, update, stats; detail query only if needed
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
  adapter is created only when a concrete route/serialization contract needs
  it; no empty placeholder layer is required.
- `index.ts` is server/application-oriented. `client.ts` is client-safe only.
- Prisma payloads, repositories, import internals, session/token mechanics,
  and generic Dashboard contexts are not public module contracts.

## 19. Employee server public API

The following is the final implemented export surface of
`modules/employee/index.ts`. Every export has a production consumer or is part
of an exported function's deliberate structural transaction contract. Tests
were used as behavioral evidence, not as the reason to retain an export.

### Route contracts

| Export | Production consumer | Contract intent |
| --- | --- | --- |
| `createEmployeeSchema`, `updateEmployeeSchema`, `employeeFiltersSchema` | `app/api/employees/route.ts`, `[id]/route.ts`, and `export/route.ts` | Preserve current input parsing and validation without exposing Prisma types |
| `EmployeeFilters` | `app/api/employees/route.ts` and `export/route.ts` | Shared route-to-application filter contract |
| `listEmployees` | `app/api/employees/route.ts` | Current paginated Employee response DTO |
| `getEmployeeStats` | `app/api/employees/stats/route.ts` | Current aggregate stats response |
| `createEmployee`, `updateEmployee`, `deleteEmployee` | Employee API route handlers | Profile/lifecycle commands with existing locks, permissions, side effects, and response behavior |
| `importEmployeesFromCsvRows`, `EMPLOYEE_IMPORT_MAX_ROWS` | `app/api/employees/import/route.ts` | Current partial-success import semantics and 1,000-row route limit |
| `createEmployeeExport` | `app/api/employees/export/route.ts` | Current filters, 2,000-row limit, batching, Thai columns, filename, and export metadata |

### Auth, signup, and cross-module contracts

| Export | Production consumer | Contract intent |
| --- | --- | --- |
| `hasEligibleEmployeeLifecycle` | Auth server and hybrid-login route | Employee-only lifecycle eligibility; it does not replace User/session authorization |
| `findSignupEmployee`, `lockAndRecheckSignupEmployee` | `app/api/auth/signup/route.ts` | Exact-email lookup and serializable transaction row-lock/recheck seam for signup concurrency |
| `getEmployeeFullName` | Signup error/audit projection and Routine server owner mapping | Pure Employee identity formatting |
| `getEmployeeDisplayName` | Leave/Routine server application/report code and the Employee client entry | Pure Employee full-name/nickname formatting |
| `EmployeeDisplayNameSource` | `modules/routine/application/recipients.ts` | Structural Employee identity projection for a server-side recipient contract |
| `applyEmployeeManagerChangesInTransaction` | `modules/leave/application/approvals/approver-assignment.ts` | Employee-owned `managerId` mutation; Leave retains approver policy and transaction coordination |
| `EmployeeOffboardingDependency`, `EmployeeOffboardingDependencyProvider` | Public parameter/return contract of Employee lifecycle mutations, bound by `app/api/employees/[id]/route.ts` | Structural Leave blocker port; preserves the same serializable `Prisma.TransactionClient` without an Employee → Leave import |

The server root does not export generic Leave approver, Routine assignee,
Stock recipient, User credential, repository, workbook, Prisma payload, or
presentation contracts. `getEmployeeById` and other internal symbols remain
private because no production consumer requires them.

Employee application code may consume shared/platform capabilities for database
transactions/locks, audit, CSV/HTTP response, and session revocation. Employee
does not export or call the global Outbox Processor, own LINE session tokens,
or reimplement authentication.

## 20. Employee client public API

`modules/employee/client.ts` exposes only the route-facing and client-safe
presentation contracts required by production routes:

| Export | Real consumer | Why it is public |
| --- | --- | --- |
| `EmployeeManagementSection` and its loading/skeleton contract | `app/dashboard/employees/page.tsx` | Feature dashboard route composition |
| `AddEmployeeSection` | `app/dashboard/employees/new/page.tsx` | Feature add route composition |
| `ImportEmployeeRouteContent` or a route-facing import composition contract | `app/dashboard/employees/import/page.tsx` | Feature import route composition and Dashboard shell integration |
| `getEmployeeDisplayName` | Leave dashboard, Routine dashboard, and `lib/audit-log/display.ts` | Proven pure browser-safe cross-feature Employee identity formatter |

The client entry must not expose server use cases, Prisma types, repositories,
database/session/secret code, import persistence internals, workbook/stream
generators, or schemas exported merely for tests. Status styling/labels, hooks,
provider, table primitives, presentation-local DTOs, and import steps remain
internal because no external production consumer requires them. Employee API
route schemas remain available through the server root `@/modules/employee`
and are not part of the client public surface.

## 21. Compatibility and deprecation plan

F1 and F2 entries below are historical compatibility records. They describe
the constraints and transitional decisions at those phase boundaries; they do
not identify remaining cleanup work.

### F1 compatibility (historical record)

- Keep all existing `/api/employees/**`, `/api/departments`, dashboard URLs,
  Thai messages, response fields, status codes, CSV headings, filename rules,
  auth requirements, and database semantics unchanged.
- Make the existing route handlers thin adapters over the new Employee server
  contracts. Do not keep two business implementations alive.
- F1 temporarily retained `lib/services/employee/**`, legacy Employee types,
  and helper exports while production consumers were moved. F2 recorded the
  migrated consumers and deferred the remaining compatibility/orphan audit to
  F3 without changing behavior; F1's legacy service paths were subsequently
  removed as part of the earlier migration.
- Preserve the Employee service's User synchronization, row locks,
  serializable transactions, lifecycle guards, and refresh-token revocation.
- Preserve the effective import maximum: the active client rejects more than
  1,000 parsed rows and the HTTP route independently rejects more than 1,000
  submitted rows. The legacy service has no row-count guard. Moving the
  invariant into the Employee application seam is optional consolidation, not
  preservation of an existing service check, and must not change client/HTTP
  behavior.
- Split lifecycle ownership without changing outcomes: Employee owns the
  Employee transition and hierarchy invariant; Auth/platform owns account and
  session-security effects; Leave owns whether outstanding Leave responsibility
  blocks the transition.

### F2 compatibility (historical record)

- The feature provider/context, feature components, forms, import flow, local
  client-safe contracts, and browser adapters now live under
  `modules/employee/presentation/**`, with the four Employee Dashboard routes
  consuming `modules/employee/client.ts` while retaining existing URLs.
- Keep generic Dashboard context/navigation outside Employee.
- The active Employee CSV parser/sample flow is local to the Employee module;
  the client entry cannot reach the mixed Prisma/Leave CSV helper.
- F2 replaced only the migrated Employee presentation's direct legacy helper
  imports; confirmed cross-feature consumers of legacy helpers were then
  resolved by F3.
- The former `lib/validations/employee.ts` facade was removed after the
  repository-wide production-consumer audit; API routes use the Employee
  module root schemas.

### F3 completed cleanup and deprecation exit

The final repository-wide consumer audit, runtime/client graph check, focused
behavioral tests, and static checks authorized removal of the following
confirmed compatibility/orphan paths:

```text
types/employees.ts
constants/employees.ts
lib/helpers/employee-helpers.ts
lib/helpers/csv-helpers.ts
hooks/useCSVImport.ts
components/employee/EditStatusModal.tsx
```

The old Employee helper tests were split into Employee identity and neutral
User display tests; Leave report label behavior was moved to Leave-owned report
infrastructure. `types/api.ts` remains because Email, Stock, and LINE contracts
still use it, but its obsolete Employee response declarations and import were
removed. The architecture checker now rejects the deleted Employee paths and
continues to enforce the Employee public-entry, deep-import, client-graph,
Employee → Leave, and Outbox Processor rules alongside the Auth/Workforce,
Leave, Routine, Stock, audit, and LINE boundaries.

## 22. Historical migration slices

The following phase descriptions are retained as the approved historical scope
and acceptance record. The completed implementation and final ownership are
recorded in the F3 implementation record and public API sections above.

### Phase F1 — Employee Server & Business Ownership

Include:

- Employee domain lifecycle/identity/hierarchy contracts;
- Employee application list/create/update/stats use cases; an Employee detail
  query may remain internal and must not be publicly exported without a real
  production consumer;
- status transitions, soft offboard, manager/hierarchy seam, and Employee-owned
  safety guards;
- the Employee-owned structural offboarding-responsibility port and its outer
  composition binding to the Leave public blocker contract;
- Auth/account safety and account/session side-effect integration while keeping
  authentication/session implementation outside Employee;
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

F1 introduced the real `modules/employee/index.ts` and initial Employee
architecture enforcement; F2 extends that enforcement for presentation route
composition and the browser-safe client graph.

F1 acceptance requires that the Employee deactivation implementation does not
copy the direct `LeaveRequest` status query into `modules/employee` and does
not runtime-import Leave. The Leave dependency check is a Leave-owned semantic
implementation of the Employee offboarding-responsibility port, bound at the
outer composition boundary. The provider must execute with the same
transaction client before lifecycle writes, preserving atomicity and
concurrency behavior. Auth/account side effects must remain owned by
Auth/platform mechanics. The resulting Employee lifecycle use case must
preserve all current externally observable behavior.

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

### Phase F3 — Employee Compatibility Cleanup & Final Re-audit (completed)

F3 removed the obsolete legacy type/helper/presentation facades, confirmed and
removed the orphaned `useCSVImport` and `EditStatusModal`, deleted the mixed
CSV helper after moving Leave report ownership, minimized both public entries,
strengthened import-graph guards, and re-audited Auth/Workforce, signup
locking, Leave manager/offboarding behavior, Routine, Stock, audit, LINE/LIFF,
and outbox boundaries. Verification results are recorded in the final report
and repository commit for this phase.

F3 does not authorize a behavior or API redesign; any such change requires a
separate request and compatibility plan.

## 23. Final test and consumer inventory

### Employee-specific tests

```text
__tests__/api/employees-routes.test.ts
modules/employee/domain/identity.test.ts
modules/employee/schemas/employee.test.ts
modules/employee/application/import-employees.test.ts
modules/employee/application/mutations.test.ts
modules/employee/infrastructure/persistence/employee-queries.test.ts
modules/employee/infrastructure/persistence/employee-list.test.ts
modules/employee/infrastructure/export/employee-export.test.ts
modules/employee/presentation/dashboard/EmployeeTable.test.tsx
modules/employee/presentation/dashboard/EmployeeTablePrimitives.test.ts
modules/employee/presentation/import/csv.test.ts
modules/employee/presentation/import/useImportCSV.test.tsx
shared/identity/display.test.ts
__tests__/integration/signup-employee-concurrency.integration.test.ts
```

`modules/employee/presentation/import/csv.test.ts` now characterizes the
Employee-owned browser parser and sample behavior. Employee identity behavior
is covered by the colocated domain test, neutral User display behavior by the
shared identity test, and Leave report labels/mapping by
`modules/leave/infrastructure/reports/report-model.test.ts`.

Additional F2 presentation coverage is colocated under the module:

```text
modules/employee/presentation/import/useImportCSV.test.tsx
__tests__/architecture/check-architecture.test.ts
```

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

The exact module test files remain owned by their respective features. The final
re-audit used them as regression evidence without relocating cross-feature
tests into Employee.

## 24. Preserved risks and follow-up boundaries

These are preserved compatibility facts and future boundaries, not unresolved
F3 ownership decisions:

1. **Combined lifecycle canonicalization:** `hasEligibleEmployeeLifecycle(null)`
   intentionally permits an unlinked User through some low-level Auth paths,
   while API/Workforce/LIFF paths require a linked active Employee. F3
   re-audited this distinction without introducing a shared authorization
   adapter.
2. **Hierarchy transaction seam:** Leave currently mutates the Employee-owned
   `managerId` while enforcing Leave-specific approver rules. The seam must
   retain atomicity and prevent races with Leave request creation and
   reassignment.
3. **Department server/presentation seam:** Resolved in G1/G2. Department
   server/application and Prisma persistence are owned by
   `modules/department/`; Employee import uses only its public
   `listDepartmentReferences()` contract, while Employee browser lookup uses
   `GET /api/departments`. There is no Organization or tenant architecture,
   and no Department client/CRUD/lifecycle behavior is implied by this seam.
4. **Backed-user display ownership:** Resolved in F3. The neutral structural
   `shared/identity/display.ts` helper preserves Employee → User name → User
   email → caller fallback precedence without depending on Employee.
5. **Mixed CSV helper:** Resolved in F3. Employee browser parsing is local to
   Employee and Leave report labels/mapping are local to Leave; the mixed global
   helper was deleted.
6. **List/stats inconsistency:** List/export exclude soft-deleted/bootstrap
   records, while stats counts do not. The UI also renders fewer stats than the
   API returns. Preserve first; decide any correction separately.
7. **Validation duplication:** Create schema, update schema, service, import,
   and Prisma each enforce different portions of email/status/department
   behavior. F3 preserved the existing split and its characterization tests;
   consolidation remains a separate behavior-changing decision.
8. **Import guarantees:** Import is partial-success, independently committed,
   has no observed audit event, and accepts unvalidated JSON rows at the HTTP
   boundary. The active client and HTTP route enforce the 1,000-row maximum;
   the application use case retains the legacy service behavior. These are
   compatibility facts and future hardening decisions.
9. **Export permission:** Employee export currently allows any authenticated
   API session. Do not infer admin-only behavior from the UI button.
10. **Prisma/runtime leakage:** Runtime Prisma imports and raw payloads must be
    kept out of the client entry and public domain contracts.
11. **Cross-module query shape:** Leave and Routine have transaction-sensitive
    Employee reads. Do not replace them with per-row module calls or a generic
    service that creates N+1 behavior without evidence.
12. **Orphaned legacy code:** Resolved in F3 by repository-wide production
    consumer proof. `useCSVImport`, `EditStatusModal`, stale Employee API
    types, duplicate Employee constants, and the mixed helpers were removed;
    unrelated `types/api.ts` contracts remain.
13. **Account consistency:** `User.employeeId` and the inverse Employee.user
    relation must remain one-to-one; signup and lifecycle mutations require
    their current locks and unique constraints.
14. **Employee ↔ Leave offboarding transaction seam:** Resolved in the F1
    corrective pass. Employee owns the structural
    `EmployeeOffboardingDependencyProvider` port; the outer composition
    boundary binds Leave's blocker implementation, passing the exact Employee
    lifecycle transaction client. This preserves atomicity and avoids a TOCTOU
    window across Leave request creation, approver reassignment, Leave action
    changes, or hierarchy changes.

## 25. Phase status

F0 remains the historical discovery record above. F1 implemented the server and
business ownership, F2 implemented the presentation ownership, and F3
completed compatibility cleanup and the final repository-wide re-audit.

Phase F1 CLOSED after the corrective pass — Employee server/business ownership
migrated. The Employee ↔ Leave runtime cycle remains removed: Leave may consume
the Employee hierarchy contract, while Employee lifecycle receives Leave
responsibility data only through its injected port at composition time.

Phase F2 CLOSED — Employee presentation ownership migrated.
Phase F3 CLOSED — Employee migration complete.
F0-F3 Employee modular-monolith migration is complete. This closure does not
claim that other application features are fully migrated.
Phase G1 CLOSED — Department server/persistence ownership migrated; Employee
continues to own Employee association and import policy.
Phase G2 CLOSED — Department presentation/client re-audit complete; Department
is intentionally server-only, Employee presentation remains the browser owner,
and direct/transitive client reachability of the Department server entry is
enforced.
