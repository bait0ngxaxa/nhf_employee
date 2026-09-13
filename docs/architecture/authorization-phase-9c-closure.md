# NHF Employee — Authorization Phase 9C Closure

สถานะ: **Phase 9C — CLOSED** สำหรับ current migrated production authorization
surfaces; **Phase 9 — CLOSED** สำหรับขอบเขตดังกล่าว; **Email Request / future IT
module — DEFERRED**

วันที่ตรวจ: 2026-09-13  
Baseline audited: `4438f1cf4f1dbbadb012d9ce9164eb6eedf1b7d2`<br>
Phase 9C implementation/fix commit: `7d1c459fb4eb3ff426e2d7935a060e0e1c05d7f0`<br>
Final documentation reconciliation: applied against the implementation/fix
commit above; the final SHA is the commit that records this documentation-only
update.

เอกสารนี้เป็น closure record ของ audit ไม่ใช่การเปิด policy ใหม่ และไม่ใช่
หลักฐานว่า authorization program ทั้งหมดเสร็จสิ้น. Compatibility floors,
Team-policy activation, Email Request, authorization administration UI และ
future hardening ยังคงอยู่นอกขอบเขตตามส่วนท้ายของเอกสารนี้

## 1. Audit methodology and verdict

การตรวจทำจาก externally reachable Dashboard RSC/page, Dashboard navigation,
client callers, `/api/**`, LIFF routes, application services, query/resource
predicates, critical transaction boundaries และ system-maintenance paths ที่
เกี่ยวข้อง. ทุกเส้นทางถูก trace ตามลำดับนี้:

```text
trusted session / system boundary
  -> account and workforce lifecycle
  -> domain authorization adapter
  -> central resolver decision
  -> domain scope/resource predicate
  -> business/workflow rule
  -> persistence or presentation projection
```

ตรวจคำค้น authorization vocabulary, role-derived checks, resolver call sites,
actor construction, `find*`/`count`/`aggregate`/mutation query boundaries,
Dashboard direct routes และทุก `createRoutineCommandActor()` ใน
`app/api/line/routine/**`. จากนั้นรัน focused suites และ repository `check`
script. การตรวจยืนยันว่า:

- migrated capability authority อยู่ใน domain adapters ที่เรียก central
  resolver; route/component ไม่เรียก generic resolver โดยอิสระ
- identity มาจาก server session/workforce resolution; resource IDs เท่านั้นที่
  มาจาก request
- execution channel มาจาก trusted route/server context; ไม่รับ `channel` หรือ
  `mode` จาก client
- resolver denial และ infrastructure error ไม่ถูกแปลงเป็น permissive allow
- collection และ ID-based detail/mutation paths ใช้ domain-owned predicates
- ADMIN ไม่ข้าม lifecycle, channel, relationship, business, workflow หรือ
  transaction invariants

ผล verdict: พบและแก้ channel-context defect ของ Routine LIFF สอง routes คือ
`reference` และ `summary`; ไม่พบ residual scattered authorization authority
หรือ bypass ใน migrated capability paths อื่น. Phase 9C จึงปิดได้สำหรับ current
migrated production surface โดยมี policy risks ที่ตั้งใจคงไว้ตาม Section 12

## 2. Registered-capability closure matrix

Registry ที่ตรวจคือ `modules/authorization/registry.ts`. มี registered
capabilities ที่ไม่ใช่ Email Request 38 รายการ. `M` คือ migrated generic path;
`D` คือ registered Routine capability ที่ migration record ระบุให้ deferred
และยังคง legacy/domain path โดยไม่สร้าง policy ใหม่. `D` ไม่ได้ถูกนับเป็น defect
เพราะการ migrate สาม capability นี้อยู่นอก Phase 9C และมี unresolved policy
contract อยู่เดิม

| Capability | Status and adapter | Channel / registered scope | Trusted production path and domain predicate | Projection / evidence |
|---|---|---|---|---|
| `employee.read` | M — Employee adapter | DASHBOARD / ALL | `GET /api/employees` → Employee adapter/resolver → Employee list query with current active/non-deleted identity predicates | `employeeCapabilities.canReadEmployees`; Employee authorization, route and projection suites |
| `employee.stats.read` | M — Employee adapter | DASHBOARD / ALL | `GET /api/employees/stats` → adapter/resolver → aggregate query | `canReadEmployeeStats`; Employee authorization/routes/projection suites |
| `employee.create` | M — Employee adapter | DASHBOARD / ALL | `POST /api/employees` → adapter/resolver → validated create service and Employee business invariants | `canCreateEmployees`; Employee authorization/routes/mutation suites |
| `employee.update` | M — Employee adapter | DASHBOARD / ALL | `PATCH /api/employees/:id` → adapter → serializable transaction re-resolves current User/Employee lifecycle before update | `canUpdateEmployees`; Employee authorization/mutation/direct-route suites |
| `employee.delete` | M — Employee adapter | DASHBOARD / ALL | `DELETE /api/employees/:id` → adapter → serializable lifecycle/offboarding transaction and target checks | `canDeleteEmployees` is projected but no production delete UI exists; route/mutation suites |
| `employee.import` | M — Employee adapter | DASHBOARD / ALL | `POST /api/employees/import` → adapter → validated import service, partial-success and audit invariants | `canImportEmployees`; Employee import/route/projection suites |
| `employee.export` | M — Employee adapter | DASHBOARD / ALL | `GET /api/employees/export` → adapter → export query and server-derived audit actor | `canExportEmployees`; Employee export/route/projection suites |
| `department.read` | M — Department adapter | DASHBOARD / ALL | `GET /api/departments` → adapter/resolver → reference-data query | `departmentCapabilities.canReadDepartments`; Department adapter/query/presentation/route suites |
| `routine.task.read` | M — Routine adapter | DASHBOARD, LIFF_SELF_SERVICE / CREATED, ASSIGNED, ALL | task management/work-item routes → Routine adapter/resolver → `buildRoutineTaskScope` / `buildRoutineTaskAccessScope` before Prisma query | `canReadTasks`; Routine adapter/query/route/LIFF/presentation suites |
| `routine.task.create` | M — Routine adapter | DASHBOARD, LIFF_SELF_SERVICE / OWN, ALL | create routes/service → adapter and transaction checks; LIFF USER input is normalized to linked Employee OWNER | `canCreateTasks`; Routine mutation/route/LIFF suites |
| `routine.task.update` | M — Routine adapter | DASHBOARD, LIFF_SELF_SERVICE / CREATED, ASSIGNED, ALL | task detail mutation → adapter/resolver → creator/active-assignee edit predicate and transaction revalidation | `canUpdateTasks` plus per-task `canEdit`; Routine mutation/query/route/presentation suites |
| `routine.task.delete` | M — Routine adapter | DASHBOARD, LIFF_SELF_SERVICE / CREATED, ALL | task detail mutation → adapter/resolver → creator-only USER delete predicate and transaction checks | `canDeleteTasks` plus per-task `canDelete`; Routine delete/route/presentation suites |
| `routine.occurrence.read` | M — Routine adapter | DASHBOARD / ASSIGNED, ALL | occurrence list/detail → adapter/resolver → occurrence-assignee predicate | `canReadOccurrences`; Routine occurrence query/route suites |
| `routine.occurrence.override` | M — Routine adapter | DASHBOARD / ALL | occurrence override route/service → adapter and active-admin transaction boundary | `canOverrideOccurrences`; Routine mutation/route/presentation suites |
| `routine.occurrence.reassign` | M — Routine adapter | DASHBOARD / ALL | occurrence reassign route/service → adapter and active target Employee/business checks | `canReassignOccurrences`; Routine mutation/route/presentation suites |
| `routine.occurrence.change_due_date` | M — Routine adapter | DASHBOARD / ALL | due-date route/service → adapter and occurrence/version/business checks | `canChangeOccurrenceDueDate`; Routine mutation/route/presentation suites |
| `routine.import.manage` | M — Routine adapter | DASHBOARD / ALL | import preview/staging/apply/cancel routes → adapter and transaction-time active Admin/target checks | `canManageImports`; Routine import/authorization/presentation suites |
| `routine.task.export` | D — deferred Routine legacy boundary; not in `ROUTINE_MIGRATED_CAPABILITIES` | DASHBOARD / ALL | `/api/routines/export` → `prepareRoutineTaskExport` → deferred all-scope work-item query; existing workforce/validation boundary and frozen legacy behavior remain | Projection intentionally omitted; export and Routine query suites freeze current policy |
| `routine.summary.read` | D — deferred Routine legacy boundary; not in `ROUTINE_MIGRATED_CAPABILITIES` | DASHBOARD, LIFF_SELF_SERVICE / ASSIGNED, ALL | Dashboard/LIFF summary routes → `getRoutineSummary`; Dashboard requested scope and existing role/domain behavior remain, LIFF route forces `scope: "mine"` | Projection intentionally omitted; summary and LIFF route suites; LIFF actor mode is now explicit |
| `routine.reference.read` | D — deferred Routine legacy boundary; not in `ROUTINE_MIGRATED_CAPABILITIES` | DASHBOARD, LIFF_SELF_SERVICE / OWN, ALL | Dashboard/LIFF reference routes → `getRoutineReferenceData`; LIFF actor is explicit and `serializeLiffRoutineReference` omits employees | Projection intentionally omitted; reference/query/LIFF suites; channel omission closed in Phase 9C |
| `stock.catalog.read` | M — Stock adapter | DASHBOARD, LIFF_SELF_SERVICE / ALL | catalog routes → Stock adapter/resolver → active catalog query | `stockCapabilities.canReadCatalog`; Stock authorization/query/route/LIFF/projection suites |
| `stock.inventory.manage` | M — Stock adapter | DASHBOARD / ALL | item/category/adjust routes → adapter → transaction locks, active references, quantity and integrity rules | `canManageInventory`; Stock authorization/mutation/route suites |
| `stock.request.read` | M — Stock adapter | DASHBOARD, LIFF_SELF_SERVICE / OWN, ALL | request list/detail → adapter → `requestedBy` predicate unless effective ALL | `canReadOwnRequests` / `canReadAllRequests`; Stock query/detail/route/LIFF suites |
| `stock.request.create` | M — Stock adapter | DASHBOARD, LIFF_SELF_SERVICE / OWN | create request → adapter in serializable transaction → actor-derived requester and availability/idempotency rules | `canCreateRequests`; Stock mutation/route/LIFF suites |
| `stock.request.cancel` | M — Stock adapter | DASHBOARD, LIFF_SELF_SERVICE / OWN, ALL | cancel/detail/review routes → adapter in transaction → requester ownership or effective ALL plus pending-state claim | `canCancelOwnRequests` / `canCancelAnyRequests`; Stock mutation/detail/route/LIFF suites |
| `stock.request.process` | M — Stock adapter | DASHBOARD, LIFF_SELF_SERVICE / ALL | issue/processing routes → adapter in transaction → request/item locks, pending status and stock availability | `canProcessRequests`; Stock mutation/route/LIFF suites |
| `stock.report.export` | M — Stock adapter | DASHBOARD / ALL | report export route → adapter → bounded report query/export | `canExportReports`; Stock export/route/projection suites |
| `leave.request.read` | M — Leave adapter | DASHBOARD, LIFF_SELF_SERVICE / OWN | Leave profile/history/detail paths → adapter → actor employee ownership or Leave participant policy where applicable | Leave capability projection; Leave authorization/query/detail/route/LIFF suites |
| `leave.approval.read` | M — Leave adapter | DASHBOARD, LIFF_SELF_SERVICE / ASSIGNED | approvals paths → adapter → effective approver predicate (`exceptionApproverId` then `approverId`) | Leave approval projection/relationship; approval query/route/LIFF suites |
| `leave.request.create` | M — Leave adapter | DASHBOARD, LIFF_SELF_SERVICE / OWN | request routes → adapter → actor-derived employee and Leave date/quota/overlap rules | Leave create projection; request/route/LIFF suites |
| `leave.request.cancel` | M — Leave adapter | DASHBOARD, LIFF_SELF_SERVICE / OWN | cancel routes → adapter/domain transaction → requester ownership, status and cancellation rules | Leave cancel projection; cancel/route/LIFF suites |
| `leave.request.approve` | M — Leave adapter | DASHBOARD, LIFF_SELF_SERVICE / ASSIGNED | approval decision routes → adapter/domain transaction → effective approver, owner exclusion and workflow state | Leave approval action projection; decision/relationship/route/LIFF suites |
| `leave.cancellation.decide` | M — Leave adapter | DASHBOARD / ASSIGNED | Dashboard cancellation decision → adapter/domain transaction → effective approver and documented recovery rule; LIFF remains channel-restricted | Leave domain projection; cancellation/LIFF denial/route suites |
| `leave.request.not_taken` | M — Leave adapter | DASHBOARD, LIFF_SELF_SERVICE / OWN, ASSIGNED | not-taken routes → adapter/domain transaction → owner or effective approver, state and reason rules | Leave action projection; not-taken/relationship/route/LIFF suites |
| `leave.approver.manage` | M — Leave adapter | DASHBOARD / ALL | approver management routes → adapter → documented Admin/account and approver eligibility policy | Leave approver-management projection; authorization/approver/route suites |
| `audit.read` | M — Audit adapter | DASHBOARD / ALL | `GET /api/audit-logs` → central Audit resolver → query filters/pagination after capability decision | `auditCapabilities.canReadAuditLogs`; Audit authorization/query/presentation/route suites |
| `notification.inbox.read` | M — Notification adapter | DASHBOARD / OWN | inbox latest/history → adapter/resolver → repository predicates with server-derived `userId` | `canReadInbox`; Notification authorization/query/repository/route/presentation suites |
| `notification.inbox.update` | M — Notification adapter | DASHBOARD / OWN | mark-one/mark-all → adapter/resolver → repository update predicates include server-derived `userId` | `canUpdateInbox`; Notification authorization/commands/repository/route/presentation suites |

The three deferred Routine entries are explicitly traced rather than silently
treated as migrated. No capability key was added, removed, widened, or
reinterpreted by Phase 9C.

## 3. Production surface inventory

| Surface | Audited entry points and authority boundary | Result |
|---|---|---|
| Routine | `app/api/routines/**`, `app/api/line/routine/**`, Routine application queries/mutations/import/export, Dashboard RSC and presentation components | Nine migrated operations use the Routine adapter/resolver; summary/export/reference retain documented deferred legacy paths. All LIFF Routine actors now carry explicit self-service mode. Task, occurrence, creator/assignee and transaction predicates remain domain-owned. |
| Stock | `app/api/stock/**`, `app/api/line/stock/**`, Stock request/catalog/inventory/report services and Dashboard/LIFF presentations | All seven registered operations use Stock adapter/resolver. List/detail use requester predicates; cancel/process/inventory revalidate in transactions. LIFF processor behavior remains explicit and scoped. |
| Leave | `app/api/leave/**`, `app/api/line/leave/**`, approvals/cancellation/not-taken/participant/attachment/recovery/report services and Dashboard/LIFF presentations | All eight registered operations use Leave adapter/resolver where their contract applies. Effective approver, participant, attachment, recovery and workflow rules remain Leave-owned. LIFF restrictions remain stricter where documented. |
| Employee | `app/api/employees/**`, Employee application/persistence/export/import and Dashboard pages/forms/providers | All seven registered operations use Employee adapter/resolver. Update/delete retain serializable lifecycle revalidation; no delete UI was introduced. |
| Department | `app/api/departments`, Employee department selectors and current-user projection | Reference read uses only `department.read / ALL`; Department is not inferred from Employee capability, ADMIN, membership or Team. |
| Audit | `app/api/audit-logs`, Dashboard audit page/projection, cleanup and export-event paths | Audit read uses central `audit.read / ALL`; cleanup is secret/system maintenance and export is authenticated event instrumentation, not an Audit data-read authority. |
| Notification | `/api/notifications`, `/all`, `/:id/read`, `/mark-all-read`, Navbar/page and Notification persistence | Read and update independently resolve `OWN`; every query/update includes server-derived owner predicate. |

No production route in the audited migrated surfaces trusts request body/query
values for actor `userId`, `employeeId`, role, system role, capability, scope,
channel, mode or `isAdmin`. Request resource IDs and view/filter parameters are
validated, then constrained by the domain adapter/query boundary.

## 4. Dashboard and direct-route parity

The following pages were inspected for manual/direct navigation independently
of menu visibility:

| Page/surface | Direct-route behavior | Presentation authority |
|---|---|---|
| `/dashboard/routine` | Trusted current-user projection plus `canReadTasks`; unavailable surface reaches access-denied behavior | Routine capability projection; `RoutineSection` `isAdmin` only selects documented presentation identity/form mode and imported metadata display |
| `/dashboard/stock` | Trusted current-user projection plus `canAccessStockDashboard`; API calls retain server authorization | Stock capability projection; role badge/identity does not authorize data or mutations |
| `/dashboard/leave` | Trusted current-user projection plus `canAccessLeaveDashboard`; tab-specific domain/relationship controls remain separate | Leave capability and relationship projection; Admin recovery/report/participant rules remain domain-owned |
| `/dashboard/employees` | Trusted current-user projection uses `canReadEmployees OR canReadStats`; Add and Import direct routes have independent capability guards | Employee capability projection; no Employee presentation ADMIN authority found |
| `/dashboard/audit` | `requireDashboardAuditCapability` checks `auditCapabilities.canReadAuditLogs`; it does not independently require ADMIN | Audit capability projection |
| `/dashboard/notifications` | Current-user projection checks inbox read capability before rendering the page | Read/update projections are independent; server routes remain authoritative |
| Employee Department selectors | Client fetches `/api/departments` only when `canReadDepartments` is projected; an authorized-empty result is distinct from unauthorized state | Department projection, never Employee/ADMIN/Team inference |
| `/dashboard/email-request` | `requireDashboardAdmin` remains intentionally active | Deferred Email Request behavior; excluded from Phase 9C |

The Dashboard menu and `handleMenuClick()` are UX projections only. Direct URL
and forged API access still encounter page/route/domain checks, and no migrated
page was changed to a generic role guard.

## 5. LIFF and execution-channel audit

Every `createRoutineCommandActor()` call under `app/api/line/routine/**` was
classified:

- task list/create and task detail routes already passed
  `{ mode: "LIFF_SELF_SERVICE" }`
- `reference/route.ts` now passes `{ mode: "LIFF_SELF_SERVICE" }`
- `summary/route.ts` now passes `{ mode: "LIFF_SELF_SERVICE" }`

The route, not request input, determines the channel. The Routine adapter maps
that mode to `LIFF_SELF_SERVICE`; a LIFF ADMIN therefore cannot acquire the
Dashboard ADMIN branch. The summary route also passes `scope: "mine"`; the
reference serializer continues to remove `employees` from the response.

Stock LIFF routes construct explicit `LIFF_SELF_SERVICE` Stock contexts and
retain their documented processor/requester rules. Leave LIFF routes construct
explicit `LIFF_SELF_SERVICE` Leave contexts; Dashboard-only cancellation
decision and Admin recovery remain unavailable through generic LIFF resolution.
`/api/line/home` is a trusted projection boundary and does not replace route
authorization.

No actor builder in the audited migrated route surface takes channel/mode from a
query string, body, browser role, or client-generated scope. Dashboard callers
continue to use their established Dashboard context/default; no broad rewrite
was needed.

## 6. Role-check classification

The repository-wide role search covered `ADMIN`, `USER`, `isAdminRole`,
`requiredRole`, session helpers, capability projections, actor fields, scope and
channel terms. Relevant production matches were classified as follows:

| Class | Representative locations | Classification decision |
|---|---|---|
| A. Central authorization implementation | `modules/authorization/application/evaluator.ts`; domain adapters under `modules/{routine,stock,leave,employee,department,audit,notification}/application/authorization.ts`; `lib/ssot/permissions.ts` | Valid central resolver role interpretation, actor parsing, compatibility translation and identity helper. Not scattered authority. |
| B. Authentication/session/workforce lifecycle | `modules/auth/application/sessions.ts`; `lib/auth/api.ts`; `lib/auth/server.ts`; `lib/auth/workforce.ts`; `lib/auth/workforce-transaction.ts`; last-active-Admin invariant in account lifecycle | Role is part of trusted account/lifecycle/security invariants. ADMIN does not bypass required account/workforce state where the route contract requires it. |
| C. Domain resource/business/workflow policy | Leave recovery, attachment participant/Admin access, exception approver fallback, cancellation/not-taken override; Routine creator/assignee and deferred summary/reference behavior; Stock processor/notification business behavior | Retained because these checks express domain relationship, resource, workflow or side-effect rules not represented by an approved generic capability. They occur alongside, or after, capability authorization and do not substitute for migrated capability decisions. |
| D. Presentation identity only | `RoutineSection.tsx` and child form/detail components; Stock provider role display; Leave dashboard tab visibility; `DashboardProvider` role/menu identity; descriptive labels | Retained where the value controls labels, layout, form mode or metadata display. No use was found that grants data visibility, mutation eligibility or API authority independently of capability/domain checks. |
| E. Deferred Email Request | `app/dashboard/email-request/page.tsx`; `app/api/email-request/**`; `lib/services/email-request/**`; Email menu `requiredRole: "ADMIN"`; `requireDashboardAdmin()` / `requireAdminSession()` callers exclusive to Email | Intentionally out of scope. These matches are documented as `DEFERRED — future IT / Email Request module`; no migration or redesign was performed. |
| F. System/bootstrap/maintenance | Audit cleanup secret route; cron/webhook/system HMAC paths; account bootstrap/last-Admin safeguards | System authentication, maintenance integrity or bootstrap invariants, not user-capability authority. |
| G. Migration compatibility behavior | `NO_APPLICABLE_GRANT` translation in each migrated adapter; Routine deferred legacy paths; legacy workforce/session adapters | Retained as migration mechanisms. Fallback is exact and does not cover unknown capability, unsupported channel, resolver failure, invalid actor or repository failure. |
| H. Actual scattered authority/bypass | No unresolved production match | The only proven Phase 9C defect was missing trusted Routine LIFF mode on `reference` and `summary`; both were fixed and regression-tested. |

Additional role matches in Routine/Stock recipient selection and audit metadata
were traced as notification/audit side effects after the relevant operation
boundary, not as access decisions. Employee `ADMIN` strings used as a
department code were classified as Department data, not system role. Department
remains separate from Team.

## 7. Central resolver ownership audit

Production direct calls to `authorization.resolve()`, `resolveMany()` and
`resolveInTransaction()` were found only in the established domain adapters:

```text
modules/routine/application/authorization.ts
modules/stock/application/authorization.ts
modules/leave/application/authorization.ts
modules/employee/application/authorization.ts
modules/department/application/authorization.ts
modules/audit/application/authorization.ts
modules/notification/application/authorization.ts
modules/authorization/**  (central implementation)
```

No audited route, page, component or generic service directly calls the resolver,
merges grants, redefines ADMIN, translates generic scopes, or substitutes a
feature-local permission registry. Routes may pass validated view/filter input
to a domain adapter; the adapter and domain query decide effective scopes and
resource predicates.

## 8. Compatibility and ADMIN semantics

| Domain | Compatibility result audited |
|---|---|
| Routine | Migrated adapter falls back only on `NO_APPLICABLE_GRANT`; LIFF ADMIN is clamped to self-service behavior. Deferred summary/export/reference behavior remains legacy and explicit. |
| Stock | Adapter and transaction resolver fallback only on `NO_APPLICABLE_GRANT`; request OWN/ALL and processor/inventory semantics remain Stock-owned. |
| Leave | Adapter fallback only on `NO_APPLICABLE_GRANT`; ASSIGNED uses effective approver relationships, cancellation channel restriction remains, and Admin recovery is domain-specific. |
| Employee | Adapter fallback only on `NO_APPLICABLE_GRANT`; current broad USER read/stats/export behavior remains compatibility policy, while mutations retain lifecycle/business checks. |
| Department | Adapter fallback only on `NO_APPLICABLE_GRANT`; no inference from Employee, Department membership, Team or ADMIN. |
| Notification | Adapter fallback only on `NO_APPLICABLE_GRANT`; both inbox capabilities remain OWN-only and do not accept ALL. |
| Audit | No normal USER compatibility floor; explicit `audit.read / ALL` is reachable, and an ungranted USER is denied. |

Resolver `UNKNOWN_CAPABILITY`, `CHANNEL_NOT_SUPPORTED`, missing decisions and
infrastructure/repository failures remain denial/error paths. No feature route
swallows those failures into allow. Explicit normal USER grants remain
reachable where the registry and adapter contract permit them; ADMIN authority
for migrated capabilities comes from the resolver, not a route-level
`if (role === "ADMIN") allow` branch.

## 9. Query, resource and transaction audit

- Routine task/occurrence reads apply effective scopes through
  `buildRoutineTaskScope`, `buildRoutineTaskAccessScope` and occurrence
  predicates before Prisma reads. ID-based detail paths retain creator,
  current-assignee or occurrence-assignee constraints. The existing USER
  all-scope work-item/summary/export behavior remains a documented frozen policy
  risk, not a presentation filter or a newly widened Phase 9C behavior.
- Stock request lists and details both apply `requestedBy` unless effective
  `ALL` is authorized. Cancel/process/inventory commands resolve capability in
  their transaction and retain row locks, status claims, stock availability and
  idempotency/concurrency rules. A guessed request ID cannot escape collection
  scope.
- Leave approval lists/counts use effective approver predicates. Detail and
  attachment participant checks are Leave-owned; owner, approver, recovery and
  workflow-state rules remain after capability authorization. Decision,
  cancellation and not-taken paths revalidate current identity/capability in
  the existing transaction boundaries.
- Employee list/stats/export queries use the Employee server path; update/delete
  re-resolve current User/Employee lifecycle in serializable transactions.
  Employee broad read/export policy is intentionally unchanged pending a policy
  decision.
- Department is an explicitly authorized organization-wide reference query.
  Audit data is queried only after `audit.read / ALL`; cleanup and export-event
  instrumentation are separate system/instrumentation paths.
- Notification reads and updates always include the authenticated owner
  `userId`; mark-one uses `{ id, userId }` and mark-all uses the same owner
  predicate. Read and update decisions are independent.

Critical transaction-time checks remain present for Employee, Stock, Leave and
Routine paths where the migration architecture requires them. No indiscriminate
new transaction or domain-policy rewrite was introduced.

## 10. Findings fixed

### Routine LIFF channel-context ambiguity

Before Phase 9C, `app/api/line/routine/reference/route.ts` and
`app/api/line/routine/summary/route.ts` omitted the optional Routine actor mode.
The Routine adapter consequently treated the actor as Dashboard-channel by
default. Reference serialization prevented a client-visible employee-list
disclosure, but the internal reference query could still take the Dashboard
ADMIN branch, and summary actor semantics were ambiguous.

The minimal fix was to pass the trusted route-derived option in both routes:

```ts
createRoutineCommandActor(user, request.headers, {
    mode: "LIFF_SELF_SERVICE",
});
```

Response shapes and supported self-service behavior are unchanged. Regression
coverage now asserts the mode for both USER and ADMIN reference requests and
for the ADMIN summary path; the summary test also keeps `scope: "mine"` and
ignores a forged `employeeId`/`scope=all` request.

No other confirmed Phase 9C authorization bypass was found or changed.

## 11. Intentional exceptions and deferred policy

The following are retained intentionally and are not residual migrated-capability
bypasses:

- Email Request (`email.request.read`, `email.request.create`,
  `/dashboard/email-request`, `/api/email-request/**` and its providers/services)
  remains **DEFERRED — future IT module**. Existing Admin/session checks remain.
- Routine `summary.read`, `task.export` and `reference.read` remain registered
  but deferred legacy/domain paths because their policy contract was explicitly
  left unresolved. Their route/service/query paths and response boundaries were
  audited; no new generic rule was invented.
- Routine USER all-scope work-item/summary/export behavior and Employee broad
  USER read/stats/export behavior remain compatibility policy risks. Phase 9C
  does not narrow them.
- Leave reports/export, participant/detail, attachments, Admin recovery,
  effective-approver and workflow exceptions remain Leave-owned or deferred
  policy. No `leave.report.export`, `leave.recovery.manage` or attachment
  capability was invented.
- Audit cleanup remains system-secret maintenance. The Audit export endpoint is
  an authenticated event recorder, not a data export authority and not a
  replacement for `audit.read`.
- Employee delete remains projected but has no production UI; no offboarding UI
  was added.
- Department remains reference data and is not Team. No Team assignment, Team
  policy activation, capability seed, or Team UI was added.

## 12. Verification evidence

The new regression expectations were first run against the pre-fix code and
failed in three assertions (two reference role cases and one summary case),
confirming the missing actor mode. After the route fix:

```text
npm.cmd run test:run -- __tests__/api/line-routine-self-service-routes.test.ts __tests__/api/line-routine-routes.test.ts
Result: 2 test files passed, 20 tests passed.
```

The focused cross-domain audit invocation covered 71 test files and the
following representative areas: central resolver; Routine authorization,
queries, mutations, delete, import/export, occurrence/task/reference/summary
routes, all Routine LIFF routes and Dashboard presentation; Stock authorization,
queries, mutations, reports, request/item/LIFF routes and presentation; Leave
authorization, approvals, exception approver, request/cancel/decision/not-taken/
attachment/recovery/LIFF routes and Dashboard presentation; Employee
authorization, mutations, presentation, API routes and Dashboard pages;
Department; Audit; Notification; current-user/workforce lifecycle; Dashboard
menu/provider/route access.

```text
npm.cmd run test:run -- modules/authorization/application/resolver.test.ts modules/routine/application/authorization.test.ts modules/routine/application/queries.test.ts modules/routine/application/mutations.test.ts modules/routine/application/delete.test.ts modules/routine/application/presentation-capabilities.test.ts __tests__/api/routines-tasks.test.ts __tests__/api/routines-task-by-id.test.ts __tests__/api/routines-reference.test.ts __tests__/api/routines-occurrences.test.ts __tests__/api/routines-occurrence-by-id.test.ts __tests__/api/routine-summary.test.ts __tests__/api/routine-export.test.ts __tests__/api/line-routine-self-service-routes.test.ts __tests__/api/line-routine-routes.test.ts __tests__/dashboard-routine-page.test.tsx modules/routine/presentation/dashboard/RoutineSection.test.tsx modules/routine/presentation/dashboard/RoutineTaskList.test.tsx modules/routine/presentation/dashboard/RoutineTaskDialog.test.tsx modules/routine/presentation/dashboard/RoutineOccurrenceList.test.tsx modules/stock/application/authorization.test.ts modules/stock/application/presentation-capabilities.test.ts modules/stock/__tests__/queries.test.ts modules/stock/__tests__/mutations.test.ts __tests__/api/stock-requests-routes.test.ts __tests__/api/stock-items-route.test.ts __tests__/api/stock-reports-export-route.test.ts __tests__/api/line-stock-routes.test.ts __tests__/dashboard-stock-page.test.tsx modules/stock/presentation/dashboard/context/StockProvider.test.tsx modules/leave/application/authorization.test.ts modules/leave/application/presentation-capabilities.test.ts modules/leave/application/approvals/approval-queries.test.ts modules/leave/application/approvals/exception-approver.test.ts __tests__/api/leave-request.test.ts __tests__/api/leave-cancel.test.ts __tests__/api/leave-decision.test.ts __tests__/api/leave-approvals.test.ts __tests__/api/leave-approvers.test.ts __tests__/api/leave-not-taken.test.ts __tests__/api/leave-attachment.test.ts __tests__/api/leave-admin-recovery.test.ts __tests__/api/line-leave-routes.test.ts __tests__/dashboard-leave-page.test.tsx modules/leave/presentation/dashboard/LeaveManagementSection.test.tsx modules/employee/application/authorization.test.ts modules/employee/application/mutations.test.ts modules/employee/application/presentation-capabilities.test.ts __tests__/api/employees-routes.test.ts __tests__/dashboard-employee-pages.test.tsx modules/department/application/authorization.test.ts modules/department/application/queries.test.ts modules/department/application/presentation-capabilities.test.ts __tests__/api/departments-route.test.ts modules/audit/application/authorization.test.ts modules/audit/application/queries.test.ts modules/audit/application/presentation-capabilities.test.ts __tests__/api/audit-log-route.test.ts __tests__/api/audit-log-cleanup-route.test.ts modules/notification/application/authorization.test.ts modules/notification/application/queries.test.ts modules/notification/application/commands.test.ts modules/notification/infrastructure/persistence/repository.test.ts modules/notification/application/presentation-capabilities.test.ts __tests__/api/notifications.test.ts __tests__/constants/dashboard-menu.test.ts __tests__/context/DashboardProvider.test.tsx __tests__/auth/current-user-projection.test.ts __tests__/auth/workforce.test.ts __tests__/auth/workforce-transaction.test.ts __tests__/dashboard-route-access.test.ts
Result: 71 test files passed, 884 tests passed.
```

Repository-required verification:

```text
npm.cmd run check
Result: passed
  architecture: checked 1,067 repository source files; passed
  lint: strict ESLint with --max-warnings=0; passed
  typecheck: tsc --noEmit; passed
  full Vitest: 301 test files passed, 2,634 tests passed
```

ตัวเลข focused และ full suite ข้างต้นเป็นผลที่บันทึกจากการรันโดย developer ใน
environment ของ Phase 9C implementation/fix; ไม่มีการอ้าง GitHub CI status หรือ
check จากหลักฐานชุดนี้

A Codex Security standard-scan launcher was also attempted, but it could not
start because this Windows environment resolves `python` to the Microsoft
Store execution alias and has no usable Python launcher. No security-scan
result was claimed from that failed launch; the repository audit and checks
above were completed independently.

## 13. Remaining risks and Phase 10 handoff

Remaining work is policy/hardening work, not an unclassified Phase 9C bypass:

- decide and separately activate policy for Routine USER all-scope and
  Employee broad read/export;
- decide Leave report/history, participant, attachment and recovery contracts;
- retire compatibility floors only in a later explicit production-policy phase;
- define and activate Team/TeamRole/membership/grant administration only after
  approval; Team is not activated by this closure;
- migrate the deferred Email Request/future IT module;
- perform later broad architecture/security hardening where warranted.

The next planned phase is **Phase 10 — Authorization Administration**, covering
operator-facing Team, TeamRole, membership, capability-grant and effective-
permission inspection workflows with their own security audit. Phase 10 was not
started here.

## 14. Phase status

```text
Phase 9A — CLOSED
Phase 9B — CLOSED
Phase 9C — CLOSED
Phase 9  — CLOSED

Scope qualifier: current migrated production authorization surfaces only

Email Request / future IT module — DEFERRED
```

This status does not mean the authorization project, all legacy authorization,
all compatibility floors, all Team policies, Email Request, Authorization Admin
UI or future hardening are complete.
