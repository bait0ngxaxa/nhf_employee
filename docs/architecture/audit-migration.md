# Audit capability migration

Status: **Phase I3 CLOSED — Audit producer integration and physical
persistence exclusivity complete.**

Audit capability migration I0-I3 is closed. Auth/Session/Identity migration
has not started.

Baseline audited: `05c2327be2f46e83a843040b978093b30a1c0289`
(`refactor(notification): migrate Leave Stock and Routine Inbox writes`).
This was the repository state immediately before the Phase I0 documentation
commit. Historical source paths and line references below refer to that
baseline and may move during I1-I3.

This record is the source of truth for the Audit capability migration. Its
baseline sections record the repository state observed during Phase I0, while
the I1 and I2 implementation sections record the current ownership result.

## 1. Scope

Phase I0 covered the complete production repository, including application
routes, migrated modules, legacy services, presentation code, Prisma schema,
architecture rules, and the tests needed to establish behavior. The discovery
searched for:

- auditLog, AuditLog, AuditAction, createAuditLog, logAuthEvent,
  logEmployeeEvent, logLeaveEvent, logDataExport;
- AuditLogDetails, AuditDetails, defineAuditDetails, audit-log, and audit.ts;
- direct Prisma delegate access through prisma.auditLog, tx.auditLog,
  client.auditLog, and equivalent resolved production calls;
- request metadata collection through next/headers, getTrustedClientIp,
  user-agent, and trusted proxy headers.

Tests and fixtures were not counted as production producers, but were inspected
where they establish rollback, query, cleanup, serialization, or presentation
semantics. The relevant evidence includes:

- Prisma schema: prisma/schema.prisma:180-266;
- generic writer and compatibility helpers: lib/server/audit.ts:1-198;
- shared details contracts: lib/audit-log/contracts.ts:1-214;
- query and cleanup services:
  lib/services/audit-log/queries.ts:1-164 and
  lib/services/audit-log/mutations.ts:1-34;
- HTTP delivery:
  app/api/audit-logs/route.ts,
  app/api/audit-logs/cleanup/route.ts, and
  app/api/audit-logs/export/route.ts;
- active Dashboard presentation:
  app/dashboard/audit/**, components/audit/**,
  components/dashboard/context/audit-logs/**, and
  components/dashboard/sections/AuditLogsSection.tsx;
- semantic tests:
  modules/audit/application/queries.test.ts,
  modules/audit/application/retention.test.ts,
  __tests__/api/audit-log-cleanup-route.test.ts,
  __tests__/audit-log-display.test.ts,
  modules/employee/application/mutations.test.ts, and
  modules/leave/application/approvals/approver-assignment.test.ts;
- retention decision: docs/adr/0003-audit-log-retention-cleanup.md;
- current architecture enforcement:
  scripts/check-architecture.mjs:659-1118 and 1150-1419.

No runtime source, Prisma schema, migration, component, route contract, or
business behavior was changed in Phase I0. At the I0 handoff, modules/audit/
and shared/audit/ did not exist; the I1 implementation below records the
subsequent runtime ownership transfer.

## 2. Current architecture at the I0 baseline

### 2.1 Persistence model

AuditLog is a physical Prisma model mapped to audit_logs. Its fields are:

- id: Int primary key;
- action: AuditAction;
- entityType: String;
- entityId: Int?;
- userId: Int? with User relation and onDelete SetNull;
- userEmail: String? actor snapshot;
- ipAddress: String?;
- userAgent: String? text;
- details: String? text containing serialized JSON;
- createdAt: DateTime with a now() default.

Indexes currently cover userId, action, entityType/entityId, and createdAt.
There is no foreign key from entityType/entityId to the affected business
record.

The AuditAction enum contains 50 values. The exhaustive classification is in
section 9. Prisma enum values STOCK_REQUEST_ISSUE and STOCK_REQUEST_CANCEL use
database mappings STOCK_REQUEST_APPROVE and STOCK_REQUEST_REJECT respectively;
these storage mappings are compatibility contracts.

### 2.2 Generic writer and compatibility helpers

lib/server/audit.ts is the current generic writer. createAuditLog:

1. resolves the request IP through next/headers and
   lib/network/trusted-client-ip.ts;
2. resolves the user-agent through next/headers;
3. serializes details with JSON.stringify;
4. calls prisma.auditLog.create;
5. catches every failure and console.error logs it without rethrowing.

Therefore createAuditLog is best-effort. A caller using it cannot fail its
primary operation because the audit insert failed.

The same file also contains logAuthEvent, logEmployeeEvent, logDataExport, and
logLeaveEvent. The first three are active compatibility APIs. logLeaveEvent
has no active production caller in the discovered repository; it remains a
legacy compatibility surface because its CUID workaround is still part of the
current implementation history.

lib/audit-log/contracts.ts currently mixes a generic AuditDetails shape with
feature-owned detail contracts:

- Stock snapshots and mutation/request details;
- Leave context and Leave mutation details;
- EmployeeApproverAuditDetails, which describes Leave-owned approver
  assignment;
- Routine actions represented by the generic shape.

This is a boundary leak, not evidence that Audit should own Stock, Leave,
Employee, or Routine event meaning. The contracts remain in place for I0.
Later phases should move event-specific builders and types to their producing
modules while retaining a generic persisted-details contract in Audit.

### 2.3 Query and maintenance services

lib/services/audit-log/queries.ts is the generic reader. It directly calls
prisma.auditLog.findMany and count, includes a selected User and Employee
projection, parses details JSON, clamps page to at least 1 and limit to
1..100, and orders by createdAt descending. It uses offset pagination and does
not add an id tie-breaker.

lib/services/audit-log/mutations.ts owns the current cleanup operation. It
deletes rows with createdAt strictly less than a cutoff computed as now minus
90 days.

lib/services/audit-log/index.ts is a legacy service barrel exposing both
operations. It is not yet an Audit module public entry.

### 2.4 Current delivery and presentation

app/api/audit-logs/route.ts is an admin-only GET adapter. It parses action,
entityType, search, userId, startDate, endDate, page, and limit, then returns
the query service result unchanged.

app/api/audit-logs/cleanup/route.ts is a secret-protected POST maintenance
adapter. app/api/audit-logs/export/route.ts records a DATA_EXPORT event after
the response path is scheduled; it is not the implementation of the export
itself.

The Dashboard path is currently legacy/shared presentation:

- app/dashboard/audit/page.tsx performs Dashboard-admin access and composes
  AuditLogsSection;
- app/dashboard/audit/loading.tsx composes the loading skeleton;
- components/dashboard/sections/AuditLogsSection.tsx owns the current
  Dashboard wrapper and mounts AuditLogsProvider;
- components/dashboard/context/audit-logs/** owns browser state and SWR
  fetching;
- components/audit/AuditLogViewer.tsx owns filters, table/card rendering,
  loading/error/empty states, and pagination;
- components/audit/AuditLogSkeletons.tsx and AuditActionBadge.tsx own
  Audit-specific visual pieces;
- lib/audit-log/display.ts owns action/entity summaries, before/after
  rendering, sensitive-field suppression, and feature-specific display
  projections;
- constants/audit.ts owns the current action labels, badge metadata, entity
  labels, and filter options.

The current browser request is GET /api/audit-logs?page=...&limit=... with
server-side filters. The Dashboard uses limit=15, while the API defaults to
20 and accepts at most 100.

### 2.5 I1 implementation result

Phase I1 establishes `modules/audit/` as the current server/application and
generic persistence owner. Its supported server entry is
`modules/audit/index.ts`, which exposes only the generic append, query, and
retention capabilities needed by current consumers:

- `appendAuditInTransaction(persistenceContext, command)` for strict writes;
- `appendAuditBestEffort(command)` for non-throwing compatibility writes;
- `getAuditLogs(filters)` for the existing generic administrative query;
- `cleanupExpiredAuditLogs(now?)`, `calculateAuditLogRetentionCutoff()`, and
  `AUDIT_LOG_RETENTION_DAYS` for retention maintenance; and
- neutral generic append/query/result contracts.

The physical Prisma adapter is
`modules/audit/infrastructure/persistence/audit-log-repository.ts`. It owns
AuditLog create, findMany, count, and deleteMany calls. The application layer
owns command semantics, persisted JSON serialization, tolerant details parsing,
query filters/pagination, and the 90-day cutoff. The application contract
accepts already-resolved IP address and User-Agent values and has no Next.js
request dependency.

`lib/server/audit.ts` remains a compatibility adapter. It retains its current
Next header/trusted-IP composition and delegates to the best-effort public
command. `lib/services/audit-log/queries.ts` and `mutations.ts` are thin
compatibility re-exports. The Audit GET and cleanup routes consume
`@/modules/audit`; authentication, cleanup-secret validation, response
composition, and export-route behavior remain in their delivery boundaries.

At the I1 closure, the current producer direct-write seams remained
intentionally unchanged for I3, and Audit presentation remained in its pre-I2
locations. After the generic transfer, the remaining production compatibility
inventory is 10 direct AuditLog expressions across 7 allowlisted files: nine
strict `create` expressions and one Routine `findMany` reader. No generic
legacy transfer file contains a direct AuditLog delegate.

## 3. Audit capability definition

The cohesive `modules/audit/` capability is a generic record-and-read
capability, not a business workflow owner. It owns generic Audit application
behavior, generic query/retention behavior, physical AuditLog persistence, and
Audit-specific Dashboard/browser presentation.

Layer-specific ownership is:

- `modules/audit/application/**`: generic Audit use cases, orchestration,
  serialization/parsing, query/pagination/retention behavior, and neutral
  contracts;
- `modules/audit/infrastructure/**`: physical AuditLog persistence and its
  repository/adapter only;
- `modules/audit/presentation/**`: Audit-specific browser/UI presentation and
  its browser-safe entry.

The Audit capability also accepts already-resolved neutral request metadata.

The producing business or platform capability must continue to own:

- when an event deserves an audit record;
- AuditAction selection;
- entity meaning and entity/reference identifiers;
- before and after snapshots;
- event-specific details and metadata;
- actor semantics;
- business trace/context values;
- whether an audit write is transaction-bound, best-effort, or deferred.

The future API must be generic in shape. A suitable conceptual boundary is an
append command containing action, entityType, entityId when representable,
actor fields, already-resolved request metadata, and details, with an
explicit transaction-bound persistence context for strict callers. This is a
contract decision only; no such API is implemented in I0. Audit must not grow
methods such as logStockRequestIssued, logLeaveApproved, or
logEmployeeOffboarded.

## 4. Ownership decision

### 4.1 Future owner: modules/audit/

The I0 ownership decision selected a first-class modules/audit/ capability
module, with a server entry and, if the presentation migration confirms the existing
Dashboard contract, a separate browser-safe client entry.

This is preferred over shared/audit/ because Audit is a cohesive capability
with its own persistence model, query use case, retention operation, HTTP
compatibility contracts, and feature presentation. It has a stable capability
boundary even though many other capabilities produce events. The modular
monolith places cohesive business/platform capabilities under modules/ and
reserves shared/ for smaller genuinely cross-domain primitives. A module
boundary also allows the architecture checker to enforce a public server
entry, a client/server graph boundary, and, at I3 closure, exclusive physical
persistence ownership.

This does not make Audit a business-domain owner. It is a platform-oriented
capability module whose public append contract is used by Auth, Employee,
Leave, Stock, Routine, and eventually IT.

### 4.2 Ownership matrix

| Concern | Current location | Future owner | I0 decision |
| --- | --- | --- | --- |
| Physical AuditLog writes | lib/server/audit.ts and migrated module internals | modules/audit/infrastructure | Preserve current locations in I0; move generic paths in I1 and producer paths incrementally in I3 |
| Generic append/serialization | lib/server/audit.ts | modules/audit/application plus infrastructure | Preserve best-effort behavior and details JSON shape |
| Event meaning and action | Auth routes, Employee, Leave, Stock, Routine, Email Request | Producing capability | Never centralize in Audit |
| Transaction decision | Producing use case and its transaction owner | Producing capability, using Audit transaction-aware contract | Preserve strict atomicity |
| Generic query/pagination | lib/services/audit-log/queries.ts | modules/audit/application/infrastructure | Preserve response and filter behavior |
| Retention deletion | lib/services/audit-log/mutations.ts | modules/audit/application/infrastructure | Preserve 90-day and secret-route contract |
| Labels and generic viewer | constants/audit.ts, lib/audit-log/display.ts, components/audit/** | Audit presentation | Keep feature display adapters narrow and browser-safe |
| Trusted client IP primitive | lib/network/trusted-client-ip.ts | shared platform | Keep independent of Audit |
| Request/header composition | routes and actor builders | app/API or shared platform composition | Do not couple Audit core to Next.js headers |
| Auth audit production | app/api/auth/** | Auth/Identity later phase | Audit only receives a generic append command |
| Email Request audit production | app/api/email-request/route.ts | Deferred IT capability | Keep compatibility seam until IT migration |

### 4.3 What remains outside Audit

Notification, NotificationOutbox, email, LINE delivery, Outbox processing,
Auth/session implementation, Employee lifecycle policy, Leave workflow policy,
Stock inventory policy, Routine import/task policy, and future IT business
semantics remain outside Audit. Audit records those events; it does not
orchestrate them.

## 5. Producer inventory

The following inventory enumerates the discovered production producer paths.
The persistence classification is repeated in the ledger in section 11.

### 5.1 Generic best-effort and compatibility producers

| File and function/use case | Action | Entity and identifier | Actor/details/metadata | Timing and failure semantics | Eventual owner |
| --- | --- | --- | --- | --- | --- |
| lib/server/audit.ts:createAuditLog | Any AuditAction supplied by caller | entityType string; optional Int entityId | userId, userEmail, serialized details; IP and User-Agent read from current Next headers | Synchronous best-effort; every failure is logged and swallowed | Audit generic append adapter |
| app/api/auth/hybrid-login/route.ts POST | LOGIN_FAILED and LOGIN_SUCCESS | User; failed id may be absent, success uses user.id | Auth result details; generic helper captures IP/User-Agent | Best-effort; helper does not fail login response | Auth remains producer |
| app/api/auth/refresh/route.ts:logRefreshSecurityEvent | LOGIN_FAILED for reuse, expired, inactive, and race/conflict failures | User; input userId | Auth-flow reason/family metadata and request IP/User-Agent in details; generic helper also captures headers | Best-effort; refresh failure is already determined by security logic | Auth remains producer |
| app/api/auth/logout/route.ts POST | LOGOUT | User; revoked.userId | Revocation details; generic helper captures request metadata | Best-effort after token revocation | Auth remains producer |
| app/api/auth/logout-all/route.ts POST | LOGOUT | User; current userId | Logout-all details | Best-effort after updateMany | Auth remains producer |
| app/api/auth/sessions/revoke/route.ts POST | LOGOUT | User; revoked session userId | Session-revocation details | Best-effort after session revocation | Auth remains producer |
| app/api/auth/reset-password/route.ts POST | PASSWORD_RESET | User; user.id | Reset details; called after the serializable password/session transaction | Best-effort and outside the reset transaction | Auth remains producer |
| app/api/auth/signup/route.ts POST | USER_CREATE | User; created user.id | after snapshot of user/name/email/role and signup/bootstrap metadata | Synchronous best-effort after the user transaction and before response; audit failure does not fail signup | Auth remains producer |
| app/api/email-request/route.ts POST | EMAIL_REQUEST | EmailRequest; integer request id | Selected request fields and authenticated actor | Synchronous best-effort; skipped for replayed/idempotent result | Deferred IT producer |
| app/api/employees/route.ts POST | EMPLOYEE_CREATE | Employee; created employee id | Employee result and actor fields | Scheduled with next/after; best-effort after response, and not part of employee creation transaction | Employee producer until I3 |
| app/api/employees/[id]/route.ts PATCH fallback | EMPLOYEE_STATUS_CHANGE when status changed, otherwise EMPLOYEE_UPDATE | Employee; route id | Before/result and requested update; generic helper captures headers | next/after best-effort fallback only when result.auditRecorded is false | Employee producer until I3 |
| app/api/employees/[id]/route.ts DELETE fallback | EMPLOYEE_DELETE | Employee; route id | Deleted employee and actor details | next/after best-effort fallback when no strict lifecycle audit was recorded | Employee producer until I3 |
| app/api/employees/export/route.ts POST | DATA_EXPORT | Employee; no entityId | entity type, count, filters, exportedAt | next/after best-effort | Exporting route supplies meaning |
| app/api/leave/export/route.ts POST | DATA_EXPORT | LeaveRequest; no entityId | entity type, count, employee count, filters, exportedAt | next/after best-effort | Leave/export route supplies meaning |
| app/api/audit-logs/export/route.ts POST | DATA_EXPORT | Request-provided entityType; no entityId | request count and filters, exportedAt | next/after best-effort; route currently accepts this body as an audit callback contract | Audit delivery compatibility path |
| modules/stock/infrastructure/persistence/audit.ts:logStockEvent | StockAuditAction, legacy generic wrapper | Mapped Stock entity type and integer id | Stock details; delegates to createAuditLog | Best-effort legacy adapter; no active production caller found | Stock compatibility seam until I3 |
| lib/server/audit.ts:logLeaveEvent | Eight Leave actions | LeaveRequest; entityId intentionally omitted | Copies the CUID into details.metadata.leaveRequestId | Best-effort legacy adapter; no active production caller found | Leave compatibility seam until I3 |

The active generic helper producers therefore include authentication,
signup, Email Request, Employee fallback/create, and three export callbacks.
No PASSWORD_CHANGE audit producer, successful refresh audit producer, or
forgot-password request audit producer was found.

### 5.2 Transaction-bound strict producers

| File and function/use case | Action(s) | Entity and identifier | Details and actor fields | Transaction evidence and eventual owner |
| --- | --- | --- | --- | --- |
| modules/employee/application/mutations.ts:writeLifecycleAudit, called by runEmployeeLifecycle | EMPLOYEE_STATUS_CHANGE or EMPLOYEE_DELETE | Employee; employee.id | before/after status, deletedAt, userId/userIsActive, employee name; userId/userEmail; no request IP/User-Agent in this helper | tx.auditLog.create is awaited inside runSerializableTransaction. Audit failure rejects the Employee lifecycle transaction and rolls back paired Employee/User changes. Employee supplies event meaning; Audit later supplies the append adapter |
| modules/leave/infrastructure/persistence/transaction.ts:createLeaveAuditInTransaction, called from createLeaveRequest | LEAVE_REQUEST_CREATE | LeaveRequest; entityId null | Leave context, snapshots, event metadata; CUID in details.metadata.leaveRequestId; userId/userEmail; no entityId because schema is Int | Receives the same Prisma.TransactionClient as the Leave serializable transaction. Failure rejects request creation and rolls back request/outbox/idempotency writes |
| modules/leave/application/approvals/decision.ts:decideLeaveRequest | LEAVE_REQUEST_APPROVE or LEAVE_REQUEST_REJECT | LeaveRequest; entityId null; CUID in metadata | Leave-specific before/after/context and decision reason | Uses the Leave transaction helper inside runSerializableTransaction; audit failure rolls back status/quota/notification/outbox work |
| modules/leave/application/cancellation/cancellation.ts:cancelLeaveRequest | LEAVE_REQUEST_CANCELLATION_REQUEST | LeaveRequest; entityId null; CUID in metadata | Leave cancellation context and requested decision | Same strict transaction; audit failure rolls back cancellation state |
| modules/leave/application/cancellation/cancellation.ts:confirmLeaveCancellation and rejectLeaveCancellation | LEAVE_REQUEST_CANCELLATION_CONFIRM | LeaveRequest; entityId null; CUID in metadata | Confirmation/rejection decision and Leave context | Same strict transaction; audit failure rolls back the confirmation/rejection |
| modules/leave/application/not-taken.ts:requestLeaveNotTaken | LEAVE_REQUEST_NOT_TAKEN_REQUEST | LeaveRequest; entityId null; CUID in metadata | Leave not-taken request context | Same strict transaction; audit failure rolls back request state |
| modules/leave/application/not-taken.ts:confirmLeaveNotTaken | LEAVE_REQUEST_NOT_TAKEN_CONFIRM | LeaveRequest; entityId null; CUID in metadata | Leave not-taken confirmation context | Same strict transaction; audit failure rolls back confirmation state |
| modules/leave/application/approvals/approver-assignment.ts:writeAudit, called by assignLeaveApprovers | EMPLOYEE_UPDATE | EmployeeApprover; employeeId | before/after approver ids/names and employee metadata; actor user fields | tx.auditLog.create is awaited inside the same Employee manager update transaction. A later failure restores manager changes and audit rows. The semantic producer remains Leave; Employee owns the manager field |
| modules/stock/application/items/item-mutations.ts:createCategory/deleteCategory | STOCK_CATEGORY_CREATE / STOCK_CATEGORY_DELETE | StockCategory; category id | Stock-specific snapshots and actor/trace metadata | createStockCommandAudit receives tx and is awaited in the transaction; failure rolls back category mutation |
| modules/stock/application/items/item-mutations.ts:createItem/updateItem | STOCK_ITEM_CREATE / STOCK_ITEM_UPDATE / STOCK_ITEM_DELETE | StockItem and StockVariant; integer ids | Stock snapshots, changed variants, actor IP/User-Agent, requestId/correlationId | Same transaction-bound command audit; failure rejects the stock mutation |
| modules/stock/application/items/item-mutations.ts:adjustStock | STOCK_ADJUST | StockAdjustment; adjustment id | Adjustment and stock snapshots, actor/trace metadata | Same serializable transaction; failure rolls back inventory adjustment |
| modules/stock/application/requests/request-creation.ts:createNewStockRequest | STOCK_REQUEST_CREATE | StockRequest; request id | Request/line snapshots, actor/trace metadata | createStockCommandAudit is awaited in the request transaction before notifications; failure rolls back request creation |
| modules/stock/application/requests/request-mutations.ts:issueRequest | STOCK_REQUEST_ISSUE | StockRequest; request id | Issue, inventory, line, and trace details | Same serializable transaction; failure rolls back issue and inventory changes |
| modules/stock/application/requests/request-mutations.ts:cancelRequest | STOCK_REQUEST_CANCEL | StockRequest; request id | Cancellation and trace details | Same serializable transaction; failure rolls back cancellation |
| modules/routine/application/audit.ts:createRoutineAuditInTransaction, called by routine mutations | ROUTINE_TASK_CREATE, ROUTINE_TASK_UPDATE, ROUTINE_TASK_DEACTIVATE, ROUTINE_TASK_DELETE, ROUTINE_OCCURRENCE_REASSIGN, ROUTINE_OCCURRENCE_DUE_DATE_CHANGE | RoutineTask or RoutineOccurrence; integer id | Routine snapshots and actor userId/userEmail/IP/User-Agent plus requestId/correlationId metadata | The helper receives tx and is awaited inside each routine mutation transaction; failure rejects the mutation |
| modules/routine/application/imports/staging.ts:createRoutineImportPreview | ROUTINE_IMPORT_UPLOAD | RoutineImportBatch; batch id | File/batch/hash/sheet/row counts and actor/trace metadata | Direct tx.auditLog.create inside runSerializableTransaction; failure rolls back import preview/batch work |
| modules/routine/application/imports/staging.ts:updateRoutineImportRow | ROUTINE_IMPORT_ROW_UPDATE | RoutineImportRow; row id | Batch/source/selection/affected employees | Same strict transaction; failure rolls back row update |
| modules/routine/application/imports/staging.ts:applyRoutineImportBatch | ROUTINE_IMPORT_APPLY | RoutineImportBatch; batch id | Selected/applied/conflict/task/row details | Same strict transaction; failure rolls back apply |
| modules/routine/application/imports/staging.ts:cancelRoutineImportBatch | ROUTINE_IMPORT_CANCEL | RoutineImportBatch; batch id | Batch/sheet cancellation details | Same strict transaction; failure rolls back cancellation |

The strict rows are not using lib/server/audit.ts. They write through a
transaction client and therefore have different failure semantics from the
generic helper. This distinction is mandatory for I1-I3.

## 6. Reader and query inventory

### 6.1 Generic admin query

app/api/audit-logs/route.ts requires an admin session. It returns 403 for
missing/unauthorized access and calls auditLogService.getAuditLogs.

The active query contract in lib/services/audit-log/queries.ts supports:

- exact action;
- exact entityType;
- userId;
- trimmed search across entityType, userEmail, User.name, Employee firstName,
  lastName, and nickname;
- a search term that exactly matches an AuditAction enum value;
- startDate and endDate applied to createdAt;
- page and limit, with page >= 1 and limit clamped to 1..100;
- descending createdAt order and offset pagination;
- selected User and nested Employee identity fields;
- details JSON parsing, where invalid JSON becomes null.

The response shape is:

auditLogs: rows with the User/Employee projection and parsed details, plus
pagination: page, limit, total, pages.

The route parser in app/api/audit-logs/route.ts is manual rather than
schema-backed: invalid integer/date query values can reach the service. I0
records this behavior as a compatibility observation and does not alter it.

There is no HTTP cache contract. React cache() is used for request-level
deduplication in the query service. No secondary ordering by id exists.

### 6.2 Routine nested audit reader

modules/routine/application/queries.ts:getRoutineOccurrenceById directly reads
up to 100 AuditLog rows for entityType RoutineOccurrence and the occurrence
entity id. It selects id, action, userId, userEmail, details, and createdAt,
orders by createdAt descending, and returns raw details strings in the routine
occurrence response.

The route app/api/routines/occurrences/[id]/route.ts authenticates and scopes
the occurrence before invoking the query. This is an active feature-specific
reader and a compatibility exception. It must not be silently replaced by
the generic admin query in a later phase; I1-I3 should provide an equivalent
narrow Audit query or preserve an explicit compatibility adapter.

### 6.3 Browser reader and display adapter

components/dashboard/context/audit-logs/AuditLogsProvider.tsx fetches the
generic HTTP endpoint through SWR, keeps previous data during revalidation,
resets page on filter/search changes, and exposes errors, refresh, pagination,
and the current rows to AuditLogViewer.

lib/audit-log/display.ts:formatAuditLogDisplay is a pure presentation adapter.
It maps action/entity/details to labels, references, summaries, and changed
fields; suppresses password/token/session/cookie/secret values and sensitive
nested fields; and contains explicit Stock, Leave, EmployeeApprover, Routine,
and DATA_EXPORT summaries. Its behavior is covered by
__tests__/audit-log-display.test.ts and is a presentation compatibility
contract, not a reason to move business workflows into Audit.

## 7. Maintenance and retention inventory

The current retention policy is 90 days:

- lib/services/audit-log/mutations.ts:calculateAuditLogRetentionCutoff
  computes now minus 90 x 24 hours;
- cleanupExpiredAuditLogs calls prisma.auditLog.deleteMany with
  createdAt < cutoff;
- app/api/audit-logs/cleanup/route.ts requires POST header
  x-cleanup-secret matching the trimmed AUDIT_LOG_CLEANUP_SECRET environment
  value;
- a missing secret returns 503 cleanupNotConfigured;
- an incorrect secret returns 403;
- success returns success, deletedCount, and cutoff as an ISO string;
- failures return the route's sanitized server error;
- cleanup does not create an audit record;
- docs/adr/0003-audit-log-retention-cleanup.md specifies an external cron and
  no in-app scheduler. Deployment controls cadence.

lib/ssot/routes.ts registers the cleanup URL. No additional scheduler or
production caller was found in the repository. Retention duration, cutoff
comparison, secret name, route method, response shape, and no-self-audit
behavior are compatibility constraints.

## 8. Presentation inventory and proposed I2 ownership

### 8.1 Current ownership classification

| Current path | Classification | Future treatment |
| --- | --- | --- |
| app/dashboard/audit/page.tsx | App Router delivery, admin access, metadata, Suspense composition | Remains app-owned route composition; imports Audit client entry after I2 |
| app/dashboard/audit/loading.tsx | App Router loading composition | Remains app-owned route composition; uses Audit client-safe skeleton |
| components/dashboard/sections/AuditLogsSection.tsx | Audit-specific Dashboard composition wrapped in generic Dashboard conventions | Move behind Audit client entry |
| components/dashboard/context/audit-logs/** | Audit-specific browser state, HTTP fetching, types | Move to Audit presentation/client-safe graph |
| components/audit/AuditLogViewer.tsx | Audit-specific viewer, filters, states, pagination | Move to Audit presentation |
| components/audit/AuditLogSkeletons.tsx | Audit-specific loading presentation | Move to Audit presentation |
| components/audit/AuditActionBadge.tsx | Audit-specific action presentation | Move to Audit presentation |
| lib/audit-log/display.ts | Audit display mapping with feature-specific projections | Move or wrap in Audit presentation; preserve pure behavior |
| constants/audit.ts | Audit action/entity registry and labels | Move or split with Audit as owner; retain feature metadata without moving business policy |
| components/dashboard/context/index.ts | Generic Dashboard context barrel that currently re-exports Audit context/types | Remove the Audit-specific re-export or retain a short-lived compatibility export during I2 |
| constants/dashboard.ts, lib/ssot/routes.ts, DashboardHomeSection | Generic Dashboard/menu/route registries and navigation composition | Remain Dashboard/SSOT-owned; Audit only supplies the destination and presentation contract |
| components/ui/**, generic pagination, generic Dashboard shell | Generic UI/platform | Remain outside Audit |
| components/dashboard/layout/DashboardNavbar.tsx and generic Dashboard context | Dashboard shell/navigation | Remain Dashboard-owned; no Audit-specific coupling is required today |

### 8.2 I2 compatibility requirements

I2 must preserve:

- /dashboard/audit access control and URL;
- GET /api/audit-logs and its response/filter/pagination contract;
- limit=15 Dashboard behavior;
- search/action/entity/date/user filters;
- loading, error, empty, refresh, responsive table/card, and pagination UX;
- Thai labels and existing display suppression;
- Employee/Leave display integration without reaching server-only module
  entries from the client graph.

The existing display adapter imports browser-safe Employee and Leave client
helpers. I2 may retain those narrow client contracts or move the required
structural formatting into an Audit-safe presentation adapter. It must not
import Employee/Leave server barrels, Prisma, Next server APIs, or business
application code into the browser graph.

## 9. AuditAction inventory

The following table classifies every value in prisma/schema.prisma:200-263.
The status means current production emission, not whether historical rows may
contain the value.

| AuditAction | Producer/capability | Entity type | Status and notes |
| --- | --- | --- | --- |
| LOGIN_SUCCESS | Auth hybrid login | User | Active |
| LOGIN_FAILED | Auth hybrid login and refresh security failures | User | Active; multiple failure paths |
| LOGOUT | Auth logout, logout-all, session revoke | User | Active |
| PASSWORD_CHANGE | Auth | User | No current producer found; keep enum/metadata |
| PASSWORD_RESET | Auth reset-password | User | Active |
| EMPLOYEE_CREATE | Employee API create | Employee | Active, best-effort after response |
| EMPLOYEE_UPDATE | Employee profile fallback; Leave approver assignment | Employee or EmployeeApprover | Active and reused across two semantic producers |
| EMPLOYEE_DELETE | Employee lifecycle and delete fallback | Employee | Active; strict lifecycle plus legacy fallback |
| EMPLOYEE_STATUS_CHANGE | Employee lifecycle and status fallback | Employee | Active; strict lifecycle plus legacy fallback |
| EMPLOYEE_IMPORT | Employee | Employee | No current producer found; prior migration explicitly leaves import audit absent |
| TICKET_CREATE | Deferred/legacy IT | Historical IT entity | Historical/storage compatibility only |
| TICKET_UPDATE | Deferred/legacy IT | Historical IT entity | Historical/storage compatibility only |
| TICKET_STATUS_CHANGE | Deferred/legacy IT | Historical IT entity | Historical/storage compatibility only |
| TICKET_ASSIGN | Deferred/legacy IT | Historical IT entity | Historical/storage compatibility only |
| TICKET_COMMENT | Deferred/legacy IT | Historical IT entity | Historical/storage compatibility only |
| TICKET_DELETE | Deferred/legacy IT | Historical IT entity | Historical/storage compatibility only |
| LEAVE_REQUEST_CREATE | Leave create request | LeaveRequest | Active; strict, CUID fallback |
| LEAVE_REQUEST_APPROVE | Leave decision | LeaveRequest | Active; strict, CUID fallback |
| LEAVE_REQUEST_REJECT | Leave decision | LeaveRequest | Active; strict, CUID fallback |
| LEAVE_REQUEST_CANCEL | Leave cancellation | LeaveRequest | Active; strict, CUID fallback |
| LEAVE_REQUEST_CANCELLATION_REQUEST | Leave cancellation request | LeaveRequest | Active; strict, CUID fallback |
| LEAVE_REQUEST_CANCELLATION_CONFIRM | Leave cancellation confirm/reject | LeaveRequest | Active; strict, CUID fallback |
| LEAVE_REQUEST_NOT_TAKEN_REQUEST | Leave not-taken request | LeaveRequest | Active; strict, CUID fallback |
| LEAVE_REQUEST_NOT_TAKEN_CONFIRM | Leave not-taken confirm | LeaveRequest | Active; strict, CUID fallback |
| USER_CREATE | Auth signup | User | Active; best-effort after user transaction |
| USER_UPDATE | Admin/User capability | User | No current producer found |
| USER_DELETE | Admin/User capability | User | No current producer found |
| USER_ROLE_CHANGE | Admin/User capability | User | No current producer found |
| STOCK_ITEM_CREATE | Stock item creation | StockItem and StockVariant | Active; strict |
| STOCK_ITEM_UPDATE | Stock item update | StockItem and StockVariant | Active; strict |
| STOCK_ITEM_DELETE | Stock item deletion path | StockItem and StockVariant | Active; strict |
| STOCK_ADJUST | Stock adjustment | StockAdjustment | Active; strict |
| STOCK_REQUEST_CREATE | Stock request creation | StockRequest | Active; strict |
| STOCK_REQUEST_ISSUE | Stock request issue | StockRequest | Active; Prisma database mapping is STOCK_REQUEST_APPROVE |
| STOCK_REQUEST_CANCEL | Stock request cancel | StockRequest | Active; Prisma database mapping is STOCK_REQUEST_REJECT |
| STOCK_CATEGORY_CREATE | Stock category creation | StockCategory | Active; strict |
| STOCK_CATEGORY_DELETE | Stock category deletion | StockCategory | Active; strict |
| SETTINGS_UPDATE | System/admin | Settings | No current producer found |
| DATA_EXPORT | Generic export callbacks | Employee, LeaveRequest, or request-provided entityType | Active; generic/platform action, producer supplies export context |
| EMAIL_REQUEST | Deferred Email Request | EmailRequest | Active; deferred compatibility producer |
| ROUTINE_TASK_CREATE | Routine task mutation | RoutineTask | Active; strict |
| ROUTINE_TASK_UPDATE | Routine task mutation | RoutineTask | Active; strict |
| ROUTINE_TASK_DEACTIVATE | Routine task mutation | RoutineTask | Active; strict |
| ROUTINE_TASK_DELETE | Routine task mutation | RoutineTask | Active; strict |
| ROUTINE_OCCURRENCE_REASSIGN | Routine occurrence mutation | RoutineOccurrence | Active; strict |
| ROUTINE_OCCURRENCE_DUE_DATE_CHANGE | Routine occurrence mutation | RoutineOccurrence | Active; strict |
| ROUTINE_IMPORT_UPLOAD | Routine import preview | RoutineImportBatch | Active; strict |
| ROUTINE_IMPORT_ROW_UPDATE | Routine import row update | RoutineImportRow | Active; strict |
| ROUTINE_IMPORT_APPLY | Routine import apply | RoutineImportBatch | Active; strict |
| ROUTINE_IMPORT_CANCEL | Routine import cancel | RoutineImportBatch | Active; strict |

There are 38 distinct enum values emitted by current production paths. The
remaining 12 are six historical TICKET values and six currently unused values:
PASSWORD_CHANGE, EMPLOYEE_IMPORT, USER_UPDATE, USER_DELETE,
USER_ROLE_CHANGE, and SETTINGS_UPDATE. None may be renamed or removed in I0.
constants/audit.ts supplies labels and badge metadata for active values and
intentionally omits the six legacy TICKET values; its registry test allows
that historical exception.

## 10. Entity identity and entityId compatibility

AuditLog.entityId is Int? (prisma/schema.prisma:184). It is not a polymorphic
foreign key. Current integer entity identities include User, Employee,
EmployeeApprover employee ids, Stock records, Routine records, and EmailRequest
ids.

LeaveRequest.id is a String CUID. The active Leave transaction writer in
modules/leave/infrastructure/persistence/transaction.ts therefore leaves
AuditLog.entityId null and writes the real Leave request id to
details.metadata.leaveRequestId. The legacy logLeaveEvent helper documents and
uses the same fallback. This is not an accidental omission: it is the current
compatibility solution.

Consequences:

- generic entityType/entityId filtering cannot identify a Leave request by its
  real CUID;
- generic query rows for Leave have a null entityId;
- lib/audit-log/display.ts and its tests use Leave metadata to build a readable
  reference and summary;
- a future string identifier or alternate typed key would be a separate
  compatibility/schema decision, not an I0 redesign;
- I1-I3 must preserve the null entityId plus metadata fallback unless an
  explicitly approved schema/API phase changes it.

No polymorphic foreign-key architecture is proposed. Historical rows and
existing display/query behavior must remain readable.

## 11. Transaction and failure-semantics ledger

| Producer group | Classification | Transaction owner/client | Does Audit failure roll back business work? | Current evidence and migration invariant |
| --- | --- | --- | --- | --- |
| Employee lifecycle: writeLifecycleAudit | TRANSACTIONAL_STRICT | Employee runEmployeeLifecycle; Prisma.TransactionClient from runSerializableTransaction | Yes | Awaited tx.auditLog.create at modules/employee/application/mutations.ts:251; mutation tests simulate audit rejection and restore state |
| Leave create/decision/cancellation/not-taken | TRANSACTIONAL_STRICT | Leave application use case and the same Prisma.TransactionClient passed to createLeaveAuditInTransaction | Yes | Direct tx write at modules/leave/infrastructure/persistence/transaction.ts:36; all listed workflows use runSerializableTransaction |
| Leave approver assignment | TRANSACTIONAL_STRICT | Leave assignLeaveApprovers transaction, including Employee manager update | Yes | Direct tx write at modules/leave/application/approvals/approver-assignment.ts:109; rollback test covers later transaction failure |
| Stock item/category/adjust/request operations | TRANSACTIONAL_STRICT | Stock application transaction and createStockCommandAudit(tx, ...) | Yes | Direct tx write at modules/stock/infrastructure/persistence/command-audit.ts:39; calls are awaited inside serializable/transaction callbacks |
| Routine task/occurrence operations | TRANSACTIONAL_STRICT | Routine application transaction and createRoutineAuditInTransaction(tx, ...) | Yes | Direct tx write at modules/routine/application/audit.ts:13; helper is called inside transaction callbacks |
| Routine import upload/row/apply/cancel | TRANSACTIONAL_STRICT | Each staging use case runSerializableTransaction callback | Yes | Four awaited direct writes at modules/routine/application/imports/staging.ts:665, 1108, 1272, 1337 |
| Auth login/refresh/logout/reset, signup, Email Request | BEST_EFFORT | Route/application operation; generic helper uses global prisma, outside the business transaction | No | lib/server/audit.ts catches and logs all failures; primary operation remains successful or retains its already-determined auth result |
| Employee create and non-lifecycle fallback writes | AFTER_RESPONSE / DEFERRED (best-effort) | Route next/after callback; global generic helper | No | app/api/employees/route.ts:98 and app/api/employees/[id]/route.ts:78,127 use after; helper swallows failures |
| Employee, Leave, and Audit export callbacks | AFTER_RESPONSE / DEFERRED (best-effort) | Export route next/after callback | No | app/api/employees/export/route.ts:67, app/api/leave/export/route.ts:69, app/api/audit-logs/export/route.ts:17 |
| Legacy logStockEvent/logLeaveEvent | BEST_EFFORT compatibility | Global generic helper; no active callers found | No | Keep only as compatibility seams until their producer migrations establish replacements |
| Routine occurrence nested reader | Not a writer | Direct global prisma read | Not applicable | Compatibility reader at modules/routine/application/queries.ts:880 |

No active producer remains UNKNOWN. The most important invariant is that a
future generic append API must accept a transaction-bound persistence context
or equivalent port for strict callers. It must not turn tx.auditLog.create into
a post-commit best-effort call. Conversely, replacing a current best-effort
helper with a throwing strict call would also change business behavior and is
not allowed without an explicit decision.

## 12. Direct Prisma AuditLog access inventory

The production repository contains 14 direct delegate expressions across 10
production files:

| File and lines | Delegate operations | Current classification | Future handling |
| --- | --- | --- | --- |
| lib/server/audit.ts:80 | prisma.auditLog.create | Generic best-effort writer | Move physical persistence behind Audit infrastructure; retain a compatibility adapter during I3 |
| lib/services/audit-log/queries.ts:128,141 | prisma.auditLog.findMany and count | Generic query reader | Audit query infrastructure in I1 |
| lib/services/audit-log/mutations.ts:20 | prisma.auditLog.deleteMany | Retention cleanup | Audit maintenance infrastructure in I1 |
| modules/employee/application/mutations.ts:251 | tx.auditLog.create | Strict lifecycle write | Replace only with a transaction-aware Audit command; preserve Employee transaction |
| modules/leave/infrastructure/persistence/transaction.ts:36 | tx.auditLog.create | Strict Leave write | Replace only with transaction-aware Audit command |
| modules/leave/application/approvals/approver-assignment.ts:109 | tx.auditLog.create | Strict cross-capability Leave/Employee write | Leave supplies meaning; Audit supplies persistence |
| modules/routine/application/audit.ts:13 | tx.auditLog.create | Strict routine write helper | Replace with transaction-aware Audit command |
| modules/routine/application/imports/staging.ts:665,1108,1272,1337 | tx.auditLog.create | Four strict import writes | Replace with transaction-aware Audit command; keep import details in Routine |
| modules/routine/application/queries.ts:880 | prisma.auditLog.findMany | Routine nested reader | Preserve as an explicit query compatibility seam or consume a narrow Audit query |
| modules/stock/infrastructure/persistence/command-audit.ts:39 | tx.auditLog.create | Strict Stock write helper | Replace with transaction-aware Audit command; keep Stock details/meaning in Stock |

The production count excludes test mocks and fixtures. The known fixture
access is modules/stock/__tests__/integration/stock-fixtures.ts:32,
client.auditLog.deleteMany, used for test cleanup. Future direct-access
enforcement must also allow tests, integration fixtures, Prisma schema and
migrations, seed/support code, and narrowly documented infrastructure support
where no runtime production ownership is implied.

## 13. Request metadata ownership

The current metadata paths are intentionally not uniform:

- lib/server/audit.ts obtains headers through next/headers and resolves
  cf-connecting-ip through lib/network/trusted-client-ip.ts;
- lib/network/trusted-client-ip.ts validates only the trusted
  cf-connecting-ip value with Node isIP; it does not blindly trust
  X-Forwarded-For or X-Real-IP;
- auth hybrid session composition reads request user-agent and trusted IP in
  lib/auth/hybrid/session.ts;
- Stock creates a request actor in
  modules/stock/presentation/stock-command-actor.ts with IP, User-Agent,
  requestId, and correlationId;
- Routine does the same in modules/routine/server/command-actor.ts;
- strict Stock and Routine audit details carry the trace values.

The recommended boundary is:

1. app/API composition or a feature command actor reads request headers;
2. the shared network primitive resolves trusted client IP;
3. the producer passes neutral optional ipAddress, userAgent, requestId, and
   correlationId values to Audit;
4. the Audit application/domain contract has no dependency on Next.js
   headers, cookies, or route objects.

The legacy generic adapter may temporarily retain next/headers for unchanged
callers. I0 does not refactor it. Request metadata is infrastructure input,
not business event meaning, but the decision to capture it and any
feature-specific trace values remains visible in the producer contract.

## 14. Cross-module dependency analysis (I0 baseline)

This section preserves the audited pre-I1/I2 dependency baseline.

Current dependencies are classified as follows:

- lib/audit-log/display.ts imports @/modules/employee/client and
  @/modules/leave/client for browser-safe pure display helpers. This is a
  client presentation dependency, not a server or persistence dependency. I2
  must preserve the safe shape or replace it with an equally narrow adapter.
- modules/leave/application/notifications/audit-details.ts imports the
  Employee public server entry to resolve Employee data while building
  Leave-owned audit details. Leave owns the context and event meaning; this is
  not an Audit-to-Employee dependency.
- Leave approver assignment consumes the public Employee hierarchy contract
  while sharing its transaction client. This is the existing deliberate
  Leave-to-Employee direction documented in the architecture rules.
- Stock, Leave, Routine, and Employee currently write AuditLog directly or
  through legacy helpers because Audit has not yet migrated. These are staged
  compatibility dependencies, not the target dependency direction.
- lib/audit-log/contracts.ts is shared by generic infrastructure and
  feature-specific types. Its Stock/Leave/EmployeeApprover leakage is an I3
  extraction task, not evidence for a larger generic Audit domain.
- no current Audit module exists. Therefore no current Audit client/server
  graph can be claimed safe or enforced as migrated.

The future Audit implementation must not depend on business module internals.
Business producers may depend on the Audit public server contract; the Audit
module must receive already-resolved generic payloads and must not import
Stock, Leave, Employee, Routine, Auth, or IT application internals merely to
interpret them.

## 15. Deferred compatibility consumers (I0/I1 baseline)

This section preserves the deferred-consumer decisions recorded before I2.

### Email Request / future IT

app/api/email-request/route.ts creates EMAIL_REQUEST through
lib/server/audit.ts only for a newly persisted, non-replayed EmailRequest. The
event meaning, selected fields, and IT workflow remain Email Request concerns.
Email Request is explicitly deferred:

Email Request -> legacy generic Audit adapter -> future Audit capability

The future IT capability will eventually own the producer semantics. I0 does
not create modules/it/, change the route, or remove the generic helper.

### Auth/session/identity

Auth remains a later producer migration. LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT,
PASSWORD_RESET, and USER_CREATE must continue to work through a compatibility
surface until the Auth phase establishes its own public producer boundary.
No Auth module is created in I0.

### Other compatibility paths

- TICKET_* enum values are historical IT storage compatibility and must remain.
- logLeaveEvent and logStockEvent have no active callers found but remain
  legacy APIs until producer migration confirms their removal is safe.
- Routine's nested AuditLog reader is an active feature response contract.
- Existing Dashboard Audit paths remain until I2.
- Generic service/query/cleanup paths remain until I1 establishes an Audit
  public server entry.

## 16. Invariants future phases must preserve

### Business ownership

Business and platform producers retain event meaning, action choice, entity
meaning, before/after snapshots, business metadata, actor semantics, trace
semantics, and the decision that an event must be recorded.

### Audit capability and layer ownership

The cohesive `modules/audit/` capability owns generic Audit application
behavior, generic query/retention behavior, physical AuditLog persistence, and
Audit-specific Dashboard/browser presentation. It does not own business
workflows.

Layer-specific ownership remains explicit:

- `modules/audit/application/**` owns generic Audit use cases, orchestration,
  serialization/parsing, query/pagination/retention behavior, and neutral
  contracts;
- `modules/audit/infrastructure/**` owns physical AuditLog persistence only;
- `modules/audit/presentation/**` owns Audit-specific browser/UI presentation.

### Transaction integrity

Every current tx.auditLog.create path remains in the same business
transaction. A future transaction-aware append must write through the supplied
transaction-bound context and propagate failure so the enclosing transaction
rolls back.

### Failure semantics

Current best-effort helpers remain non-throwing from the primary operation.
Current after-response callbacks remain after-response/deferred. Strict and
best-effort behavior must not be normalized.

### HTTP and presentation compatibility

Active Audit API URLs, response shape, filters, pagination, ordering,
details parsing, cleanup secret behavior, and export callback behavior remain
unchanged. Dashboard UX, loading/error/empty states, labels, search,
pagination, and sensitive-field suppression remain unchanged through I2.

### Historical data compatibility

Do not rename/remove AuditAction enum values, change Prisma storage mappings,
or reinterpret historical TICKET rows. Preserve Leave's CUID metadata
fallback and current details serialization/parsing behavior.

### Scope boundaries

Do not migrate Auth, Email Request, Outbox, Notification, or other unrelated
capabilities as part of Audit migration. Do not introduce an event bus,
CQRS, event sourcing, or speculative polymorphic identity design.

## 17. I1 implementation result

I1 is closed with the following behavior-preserving implementation:

1. `modules/audit/` now provides the server public entry and proportional
   application/infrastructure layers.
2. The Audit infrastructure repository owns all generic AuditLog create,
   findMany, count, and deleteMany calls.
3. The generic append contract accepts resolved actor/request metadata and
   persisted details. `appendAuditInTransaction` writes through the supplied
   transaction context and propagates failures; `appendAuditBestEffort`
   catches and logs failures.
4. `lib/server/audit.ts` retains its signatures, trusted IP/User-Agent
   collection, details shape, and compatibility helpers while delegating
   persistence through the public Audit entry.
5. The legacy query and retention service paths are thin re-exports, while
   their application behavior is owned by Audit.
6. The Audit query and cleanup routes consume `@/modules/audit`; admin auth,
   cleanup-secret validation, status codes, response shapes, and sanitized
   errors remain at the HTTP boundary.
7. Employee, Leave, Stock, Routine, Auth, Email Request, export semantics,
   Routine's nested reader, and all Audit presentation remain outside this
   phase as documented compatibility/deferred work.

I1 does not introduce an action taxonomy change, alter `AuditLog.entityId`,
change the Prisma schema or migrations, or move feature-specific detail
builders into Audit. The exact remaining direct-access compatibility shape is
enforced in section 20.

## 18. I2 implementation result

I2 is closed with the following behavior-preserving presentation ownership:

1. `modules/audit/presentation/dashboard/**` owns the Audit Dashboard section,
   provider/context, browser response types, viewer, skeletons, action badge,
   display formatter, and action/entity registry.
2. `modules/audit/client.ts` is the browser-safe public entry. It exposes
   `AuditLogsSection`, `AuditLogsSectionSkeleton`, and the existing pure
   `formatAuditLogDisplay` contract required by cross-capability presentation
   tests.
3. `app/dashboard/audit/page.tsx` and `loading.tsx` remain App Router
   composition. The page still owns `requireDashboardAdmin()`, metadata, and
   Suspense; both route files consume Audit presentation only through
   `@/modules/audit/client`.
4. The provider still requests `GET /api/audit-logs` with `limit=15`, keeps
   previous SWR data, debounces search, serializes the same non-default
   filters, resets/clamps pagination in the same cases, and refreshes through
   SWR mutate.
5. The viewer's heading, Thai wording, display summaries, sensitive-field
   suppression, date formatting, responsive mobile/table presentation, and
   loading/error/empty/pagination behavior remain unchanged.
6. `components/dashboard/context/index.ts` no longer re-exports Audit-specific
   context. The obsolete Audit presentation paths under `components/`, `lib/`,
   and `constants/` were removed after repository-wide consumer inspection.
7. Audit presentation retains only browser-safe Employee and Leave contracts;
   its runtime graph does not reach the Audit server entry, Prisma, server-only
   dependencies, or other module server entries.

The I2 client and presentation rules are enforced in
`scripts/check-architecture.mjs`, including route composition, deleted-path,
self-barrel, and transitive client-graph checks. I1 server/application/
persistence behavior and the exact 10-expression/7-file producer-reader
compatibility shape remain unchanged. Phase I3 producer migration has not
started.

## 19. Proposed I3 producer migration

I3 should migrate producers vertically and one capability at a time:

1. Employee lifecycle and fallback/create paths;
2. Leave request/approval/cancellation/not-taken and approver assignment;
3. Stock command audit paths;
4. Routine task/occurrence/import paths;
5. Auth/session producers in the later Auth phase;
6. Email Request only when the future IT capability is approved.

For each slice:

- the producing module chooses action, entity, identifier, snapshots, details,
  actor semantics, and strict/best-effort policy;
- strict callers pass the exact transaction-bound context;
- best-effort and after-response callers retain their non-throwing behavior;
- feature-specific detail contracts/builders move out of
  lib/audit-log/contracts.ts to the producing capability;
- Audit receives only a generic append command;
- request metadata and trace values remain available where they are today;
- tests prove rollback or non-failure behavior as appropriate before the
  legacy direct access is removed.

Only after all consumers are migrated should the old direct delegates,
generic feature-specific helper methods, and obsolete presentation paths be
removed. The migration must preserve Email Request and Auth compatibility
seams until their own phases.

## 20. I1 and I2 architecture checker enforcement

I1 adds the server-boundary and staged persistence rules to
`scripts/check-architecture.mjs`. The checker uses TypeScript AST inspection
for direct and simple aliased AuditLog delegates, then validates the exact
operation/count shape of each temporary producer path. A path-only exception is
not sufficient to pass.

### I1 server and persistence rules

- app/api/audit-logs/** query and cleanup routes must consume
  @/modules/audit rather than lib/services/audit-log internals;
- any future Audit write route must consume the Audit public server contract;
- new Audit-owned physical AuditLog delegate access must be under
  modules/audit/infrastructure/**;
- the exact baseline direct-access allowlist below is temporary and finite;
  generic legacy transfer paths have exited the allowlist after their I1
  ownership transfer, while the listed business producer and Routine reader
  paths remain allowed until their I3 migration slice;
- new direct AuditLog delegate access outside modules/audit/infrastructure/**
  and outside that exact baseline allowlist must be rejected;
- migrated business modules may call the Audit public append contract,
  including a transaction-aware form, but may not deep-import Audit
  infrastructure;
- do not flag legitimate tests, integration fixtures, Prisma schema/migrations,
  seed/support code, or documented infrastructure support;
- do not treat notificationOutbox or unrelated model names as AuditLog access;

#### I1 temporary direct-access allowlist

This is the evidence-backed baseline of production files that still contain
direct AuditLog delegates outside the current owner. The checker allows only
the exact operations and counts in these files; a new file or an additional or
different delegate expression fails the architecture check.

| Transition category | Exact baseline paths | Exit condition |
| --- | --- | --- |
| Generic I1 transfer seams | `lib/server/audit.ts`; `lib/services/audit-log/queries.ts`; `lib/services/audit-log/mutations.ts` | Closed in I1; these files now delegate through `@/modules/audit` and contain no direct AuditLog delegate |
| Business producer seams retained through I3 | `modules/employee/application/mutations.ts`; `modules/leave/infrastructure/persistence/transaction.ts`; `modules/leave/application/approvals/approver-assignment.ts`; `modules/stock/infrastructure/persistence/command-audit.ts`; `modules/routine/application/audit.ts`; `modules/routine/application/imports/staging.ts` | Migrate each producer slice to the transaction-aware or best-effort Audit public contract in I3, then remove its exception |
| Routine feature-specific reader seam | `modules/routine/application/queries.ts` | Migrate to a narrow Audit public query contract or retain only with an explicitly approved architectural reason; it must not become a permanent accidental exception |

The active allowlist is path-specific and contains 10 production delegate
expressions across 7 files: `auditLog.create` x1 in each of Employee,
Leave transaction, Leave approver assignment, Stock command audit, and Routine
audit; `auditLog.create` x4 in Routine import staging; and
`auditLog.findMany` x1 in the Routine nested reader. The three generic I1
transfer files from the 14-expression I0 inventory are no longer exceptions.
The allowlist is not a wildcard for legacy code and does not permit new direct
access in an existing file.

### I2 client and presentation rules

- app/dashboard/audit/page.tsx and loading.tsx must consume
  @/modules/audit/client for Audit presentation;
- Audit client entry and all reachable runtime code must not reach Prisma,
  lib/db, lib/server, Next server-only APIs, secrets, Email/LINE, Outbox, or
  the Audit server/application/infrastructure entry or another module's server
  entry;
- Audit presentation internals must use local contracts and must not self-import
  the server/client public barrels;
- deleted components/audit, Dashboard Audit context/section, display, and
  registry paths are rejected after their replacement and consumer migration
  are complete.

### I3 producer rules

- At I3 closure, physical AuditLog create/read/update/delete delegates in
  production must resolve only under
  modules/audit/infrastructure/**. This is the final physical persistence
  exclusivity rule, not an I1 rule.
- Remove the I1 temporary allowlist as each Employee, Leave, Stock, and
  Routine producer slice is migrated. The generic I1 transfer exceptions must
  already be closed; the Routine nested reader must use a narrow Audit query
  contract or have an explicit approved exception with a documented exit.
- migrated business producers may use only the Audit public server entry;
- no business module may call prisma.auditLog or tx.auditLog directly;
- event-specific details remain in the producer module;
- generic Audit code must not import business module internals;
- the checker should distinguish a transaction-bound public append call from
  forbidden physical delegate access.

These rules follow the existing checker style: public module entries,
client/server graph checks, owner-exclusive physical persistence, explicit
compatibility exceptions, and phased enforcement. I2 presentation rules are
now active; I3 producer exclusivity remains staged and is not enabled by this
phase.

## 21. Open risks and unresolved questions

1. Leave CUID identity remains the largest compatibility risk. The current
   null entityId plus details.metadata.leaveRequestId behavior must be
   preserved until a separate identity/schema decision is approved.
2. The generic writer couples request metadata to Next headers and swallows
   all errors. Moving it without an explicit failure-policy boundary could
   silently change behavior.
3. EMPLOYEE_UPDATE is reused for Employee profile updates and
   EmployeeApprover assignment. Action/entity pairing and detail semantics must
   remain distinguishable.
4. The query uses offset pagination and createdAt-only ordering. These are
   current contracts, although equal timestamps can make page boundaries
   unstable.
5. Details parsing treats invalid JSON as null. A stricter parser would be a
   compatibility change.
6. The Audit export callback accepts request-provided entityType/count/filter
   data without a domain export implementation in this route. This is not
   changed in I0; validation and authorization should be reviewed separately.
7. The generic action/entity registry includes display compatibility values
   such as Stock and Leave that were not found as current direct producer
   entity types. Removing them could break historical/display behavior.
8. The Routine occurrence nested reader bypasses the generic query service and
   returns raw details. Its response must be treated as a separate contract.
9. After-response execution is best-effort by design in the current routes.
   I3 must not make those writes synchronous or transaction-bound without an
   explicit product decision.
10. Auth and Email Request remain producers during the staged migration. Their
    compatibility adapters must not be deleted when the main business modules
    move.

## Verification record

The I0 verification below is retained as historical handoff evidence. The
Phase I1 implementation was verified after the runtime and test ownership
changes:

- `npm.cmd run check` — passed; architecture check inspected 954 repository
  source files, lint:strict passed, typecheck passed, and Vitest passed with
  240 test files and 1,955 tests.
- `npm.cmd run architecture:check` — passed.
- `npm.cmd run lint` — passed.
- `npm.cmd run typecheck` — passed.
- `npm.cmd run test:run` — passed.

The repository's plain `npm run` form is not used for the final commands in
this Windows environment because PowerShell execution policy blocks
`npm.ps1`; the `npm.cmd` commands execute the same package scripts.

### Phase I2 verification

Verification was executed after the Phase I2 presentation ownership migration
and closure correction:

- `npm.cmd run check` — passed; architecture check inspected 955 repository
  source files, lint:strict passed, typecheck passed, and Vitest passed with
  241 test files and 1,977 tests.
- `npm.cmd run architecture:check` — passed; checked 955 repository source
  files.
- `npm.cmd run lint` — passed.
- `npm.cmd run typecheck` — passed.
- `npm.cmd run test:run` — passed; 241 test files and 1,977 tests.
- Thai/UTF-8 diff inspection — passed; no mojibake or unintended presentation
  wording changes were found.

### Phase I3 verification

Verification was executed after the Phase I3 producer, reader, contract, and
architecture-checker changes:

- `npm.cmd run check` — passed; architecture check inspected 959 repository
  source files, lint:strict passed, typecheck passed, and Vitest passed with
  244 test files and 2,001 tests.
- `npm.cmd run architecture:check` — passed; checked 959 repository source
  files.
- `npm.cmd run lint` — passed.
- `npm.cmd run typecheck` — passed.
- `npm.cmd run test:run` — passed; 244 test files and 2,001 tests.
- Exhaustive production AuditLog delegate search — passed; 5 expressions in
  1 Audit infrastructure file and zero outside `modules/audit/infrastructure/**`.
- `git diff --check` and Thai/UTF-8 diff inspection — passed; no mojibake or
  unintended Audit presentation text changes were found.

## 22. Final I0 closure checklist (historical)

- [x] Every discovered production AuditLog writer is inventoried.
- [x] Every direct production AuditLog Prisma access is classified.
- [x] Generic and Routine-specific readers are inventoried.
- [x] Retention and cleanup route behavior is documented.
- [x] Dashboard and display ownership is documented with an I2 map.
- [x] Every AuditAction enum value is classified.
- [x] Transaction-bound, best-effort, and after-response semantics are explicit.
- [x] AuditLog.entityId and Leave CUID compatibility are documented.
- [x] Auth producers are documented.
- [x] Email Request is explicitly deferred.
- [x] Future owner location is justified.
- [x] I1, I2, and I3 boundaries are defined.
- [x] Future architecture checker rules and legitimate exceptions are defined.
- [x] No runtime business behavior was changed in I0.
- [x] Verification was run after the documentation changes; results are recorded
  in the Phase I0 handoff.
- [x] Phase I0 was closed at the handoff; Phase I1 had not started at that time.

The source-of-truth I0 handoff remains complete. The current I1 closure is
recorded above and in the checklist below.

## 23. Final I1 closure checklist

- [x] `modules/audit/` exists with a supported server entry.
- [x] Generic append, query, and retention persistence is owned by Audit
  infrastructure/application code.
- [x] Strict transaction-bound and best-effort append semantics are distinct
  and tested.
- [x] Audit query and cleanup routes consume `@/modules/audit`.
- [x] Generic legacy AuditLog persistence paths are compatibility wrappers.
- [x] The exact 10-expression, 7-file producer/reader compatibility shape is
  architecture-checked.
- [x] Employee, Leave, Stock, Routine producers, Auth, Email Request, and
  Routine nested-reader semantics remain deferred as specified.
- [x] At I1 closure, Audit presentation was deferred to Phase I2.
- [x] Prisma schema and migrations remain unchanged.

Phase I1 CLOSED — Audit server/application/persistence foundation complete.
Phase I2 CLOSED — Audit presentation ownership complete.

## 24. Final I2 closure checklist (historical pre-I3 state)

- [x] `modules/audit/client.ts` is the browser entry.
- [x] Audit Dashboard routes consume `@/modules/audit/client`.
- [x] Audit presentation lives under `modules/audit/presentation/**`.
- [x] The Audit client graph is server-safe.
- [x] Audit presentation does not reach Prisma or a server entry.
- [x] Legacy Audit presentation paths are removed.
- [x] Dashboard Audit context is no longer owned by generic Dashboard context.
- [x] Formatter and action/entity registry behavior is preserved.
- [x] Thai wording is preserved.
- [x] I1 persistence invariants remain intact.
- [x] The remaining I3 direct-access inventory is 10 expressions across 7
  files.
- [x] No producer migration occurred.
- [x] No Prisma schema or migration changed.
- [x] Auth remains deferred.
- [x] Email Request/IT remains deferred.
- [x] I2 verification passed and is recorded above.

Phase I2 CLOSED — Audit presentation ownership complete.
Phase I3 NOT STARTED.

## 25. Phase I3 implementation result

Phase I3 migrated the remaining Employee, Leave, Stock, and Routine Audit
producer and reader seams without changing their event meaning, failure
policy, persisted details, or request timing.

### Producer migrations

- Employee lifecycle `writeLifecycleAudit` now calls
  `appendAuditInTransaction(tx, command)` through `@/modules/audit`. The
  serializable Employee transaction still owns the same strict failure path,
  and the Employee action/entity, before/after, actor, and employee-name
  metadata are unchanged. The strict path still intentionally supplies no
  request IP or User-Agent.
- Employee route create/update/delete fallback producers now live in the
  Employee application capability and call `appendAuditBestEffort`. Routes
  resolve the trusted Cloudflare client IP and User-Agent before scheduling
  the existing `after(...)` callback. `result.auditRecorded === true` still
  suppresses the fallback, so lifecycle events are not double-logged.
- Leave workflow writes and Leave approver assignment now call the public
  transaction-aware append with their existing transaction client. Leave
  request IDs remain CUIDs in `details.metadata.leaveRequestId`; the
  `LeaveRequest` `entityId` remains omitted/null-compatible with the Int
  schema. Approver assignment remains Leave-owned and retains its
  `EmployeeApprover` meaning and manager snapshots.
- Stock command audit is now a strict public Audit append. Stock owns its
  action/entity mapping and detail builders, including the persisted
  `STOCK_REQUEST_ISSUE`/`STOCK_REQUEST_CANCEL` mappings and exact trace
  metadata omission/merge behavior. The unused `logStockEvent` adapter,
  export, and file were removed after the current production search found no
  caller.
- Routine task/occurrence writes and all four import staging writes
  (`ROUTINE_IMPORT_UPLOAD`, `ROUTINE_IMPORT_ROW_UPDATE`,
  `ROUTINE_IMPORT_APPLY`, and `ROUTINE_IMPORT_CANCEL`) now use the public
  transaction-aware append. Their actor, IP/User-Agent, details, import
  selections/conflicts, and request/correlation metadata shapes remain
  unchanged, including Routine's explicit null trace values.

### Routine history query

Audit now exposes the narrow generic server contract
`getAuditEntityHistory({ entityType, entityId, limit })`. Its infrastructure
projection selects only `id`, `action`, `userId`, `userEmail`, `details`, and
`createdAt`, orders by `createdAt desc`, applies the requested limit, and
returns raw details without user projection or JSON parsing. Routine uses it
for occurrence history and continues converting `createdAt` to an ISO string
at its response boundary; it does not use the generic administrative Audit
query.

### Feature-owned contracts and legacy compatibility

Stock detail snapshots/building contracts now live in
`modules/stock/domain/audit-details.ts`; Leave context, mutation, create,
and approver-assignment contracts now live in `modules/leave/domain/audit.ts`.
The feature-specific `lib/audit-log/contracts.ts` source was deleted after
its consumers were migrated. Employee, Leave, and Stock feature-specific
legacy helpers (`logEmployeeEvent`, `logLeaveEvent`, and `logStockEvent`) were
removed after exhaustive production searches found no remaining callers.

`lib/server/audit.ts` remains only as deferred generic compatibility for
Auth (`logAuthEvent` and signup `createAuditLog`), Email Request
(`createAuditLog`), and export (`logDataExport`) flows. Auth/Session/Identity,
Email Request/future IT, and generic export ownership are intentionally not
migrated in I3.

### Final physical AuditLog inventory and enforcement

The final production direct AuditLog delegate inventory is exclusively:

| Owner | Operations | Count |
| --- | --- | ---: |
| `modules/audit/infrastructure/persistence/audit-log-repository.ts` | `auditLog.create` | 1 |
| `modules/audit/infrastructure/persistence/audit-log-repository.ts` | `auditLog.findMany` | 2 |
| `modules/audit/infrastructure/persistence/audit-log-repository.ts` | `auditLog.count` | 1 |
| `modules/audit/infrastructure/persistence/audit-log-repository.ts` | `auditLog.deleteMany` | 1 |
| **Production total** |  | **5 expressions in 1 file** |

Tests, integration fixtures, Prisma schema/migrations, and narrowly classified
test-support files remain separate non-production exceptions. The architecture
checker no longer has the I1/I2 10-expression/7-file compatibility allowlist;
every production AuditLog delegate operation outside
`modules/audit/infrastructure/**` now fails. Cross-module producers are
required to use only `@/modules/audit`, and Employee/Leave/Stock/Routine
production code is rejected if it reintroduces `@/lib/server/audit`.

### I3 verification

The exact final source-file count, Vitest file/test counts, lint, typecheck,
architecture, aggregate check, and Thai/UTF-8 diff results are recorded in
the verification record below after the final checks complete.

## 26. Final I3 closure checklist

- [x] Employee strict lifecycle and after-response producers use Employee
  semantics plus the public Audit capability.
- [x] Leave workflow and approver-assignment writes preserve strict rollback
  behavior and Leave CUID compatibility.
- [x] Stock strict command writes preserve actor, trace, action, entity, and
  details behavior; unused `logStockEvent` was removed.
- [x] Routine strict task/occurrence/import writes are migrated.
- [x] Routine occurrence history uses the narrow raw entity-history query.
- [x] Feature-specific Stock and Leave Audit contracts are capability-owned;
  `lib/audit-log/contracts.ts` is deleted.
- [x] The temporary direct-access allowlist is removed.
- [x] Production physical AuditLog access is exclusive to Audit infrastructure.
- [x] Generic admin query, retention, cleanup, client presentation, schema,
  and AuditAction taxonomy behavior are unchanged.
- [x] Auth/Session/Identity migration has not started.
- [x] Email Request/future IT migration has not started.

Phase I3 CLOSED — Audit producer integration and physical persistence
exclusivity complete.
Audit capability migration I0-I3 CLOSED.
Auth/Session/Identity migration NOT STARTED.
