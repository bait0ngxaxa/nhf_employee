# Phase G0 — Organization / Department Discovery & Boundary Definition (historical record)

Status: **Phase G0 CLOSED — historical discovery record; Phase G1 CLOSED — Department server/persistence ownership complete; Phase G2 CLOSED — Department server-only client/presentation boundary confirmed**

Discovery date: 2026-09-06

This document preserves the G0 discovery record and its pre-G1 observations.
The current authoritative product and implementation decisions are recorded in
Sections L and M below. G0's conditional Organization branch is historical and
has been superseded by the permanent single-NHF-organization decision.

## Post-G0 product decision (current architectural invariant)

NHF Employee is permanently a single-NHF-organization system. It is not and
will not become a multi-tenant or multi-organization application.

There is no `Organization` domain, `modules/organization/`, `organizationId`,
`tenantId`, organization membership, organization switching, tenant middleware,
tenant-scoped query behavior, organization-isolation RLS, or organization-scoped
uniqueness in this product. The current global Department `name` and `code`
uniqueness is intentional.

This decision supersedes the conditional future Organization/reference-data
recommendation recorded in the G0 sections below. Those sections remain as a
historical discovery record; they are not a future target for NHF Employee.

## A. Phase status

G0 is closed because the repository-wide discovery is complete and every item
that cannot be determined from code or schema is explicitly recorded as an
open product requirement. An unresolved product requirement does not justify
inventing a persistence model during discovery.

The evidence base is primarily:

- `prisma/schema.prisma` and the Department/Employee/Leave/Routine migration
  history under `prisma/migrations/`;
- `app/api/departments/route.ts`, `modules/employee/`, `modules/leave/`,
  `modules/routine/`, `modules/stock/`, `lib/auth/`, and the Dashboard and
  email-request presentation paths; and
- the completed migration records in
  `docs/architecture/employee-migration.md`,
  `docs/architecture/modular-monolith.md`,
  `docs/architecture/module-boundaries.md`,
  `docs/architecture/dependency-rules.md`, and `modules/README.md`.

G0 acceptance checklist:

- [x] Meaningful production Department consumers are inventoried in Section C.
- [x] Department persistence and historical schema evolution are documented in Section B.
- [x] Employee-to-Department ownership is separated into entity ownership and association ownership.
- [x] `affiliation`, `departmentId`, and `managerId` are traced and distinguished.
- [x] Leave, Routine, and Stock dependencies are audited.
- [x] Auth, session, authorization, Dashboard, and client representations are audited.
- [x] Free-text and snapshot-style Department values are classified.
- [x] Organization presence or absence and implicit single-organization assumptions are documented.
- [x] A current boundary decision and a conditional future boundary are stated with rejected alternatives.
- [x] Future server, client-safe, and cross-module contracts are identified without implementing them.
- [x] `/api/departments` migration ownership is defined.
- [x] The possible Organization/multi-tenant blast radius is recorded without implementation.
- [x] Unknown product semantics are separated from repository facts in Section I.
- [x] A concrete G1/G2/G3 sequence is recorded in Section J.
- [x] No Organization/tenant implementation or runtime behavior change was made.

## B. Observed current state (G0 historical snapshot, before G1)

Sections B-K retain the evidence and decisions captured when G0 closed. Any
description of direct Department access, a transitional owner, unresolved
Organization requirements, or a conditional future module describes that
historical point in time, not the current G1 implementation.

### B1. Department persistence

The current database has a canonical `Department` table/model:

| Field or property | Observed behavior |
| --- | --- |
| Identity | Auto-incrementing `id`; table mapped to `departments`. |
| Name and code | Both are required and globally unique (`@unique`). There is no organization-scoped uniqueness. |
| Other fields | Optional `description`, `createdAt`, and `updatedAt`. |
| Lifecycle | No `status`, `deletedAt`, archive state, or lifecycle service. |
| Hierarchy | No parent/ancestor field and no Department-head field. |
| Relationships | `Employee.departmentId` is a required many-to-one relation. |
| Indexes | Primary key, unique name/code indexes, and the Employee-side `departmentId` index. No organization, parent, or lifecycle index exists. |
| Deletion | No production Department delete route or service was found. The historical FK is `ON DELETE RESTRICT`, so a physical delete is blocked while any Employee row still references the Department; soft-deleted Employees still retain that FK. |

`Employee` owns the required association currently persisted as
`departmentId`; `Employee.dept` is the Prisma relation used by projections.
Employee itself has globally unique `email`, nullable free-text `affiliation`,
and nullable self-referential `managerId`. There is no organization foreign
key on either model.

The initial Department/Employee migration,
`prisma/migrations/20250910045405_add_employee_department_models/migration.sql`,
created both the old string fields and the relational `departmentId`, and
created Department name/code uniqueness plus the restrictive FK. The following
migrations establish the historical distinction rather than a current
Organization concept:

- `20250910045902_remove_duplicate_department_field` dropped the old
  `employees.department` string field and recorded that its data would be lost.
- `20250910064907_add_affiliation_remove_salary_employeecode` added
  `employees.affiliation` as a nullable string; it did not create a relation.
- `20250911052333_add_missing_tables` dropped the old nullable
  `users.department` string field.
- `20260313094628_init_leave_management` added the Employee self-FK
  `managerId` with `ON DELETE SET NULL` and created Leave relations.
- `20260803090000_add_leave_exception_approver_assignment` added the separate
  Leave exception approver relation.
- `20260803120000_add_routine_core` added required Routine assignee relations
  to Employee. It did not add Department or Organization ownership.

`prisma/seed.ts` upserts only the current baseline Department records
`ADMIN`/`บริหาร` and `ACADEMIC`/`วิชาการ`, then uses the ADMIN record for the
bootstrap Employee. This is seed data, not evidence of a general Department
administration workflow.

### B2. Department delivery and writes (G0 snapshot)

`app/api/departments/route.ts` is the only production Department route found.
It exposes an authenticated `GET`, reads Prisma directly, orders by `name asc`,
and returns `{ departments }`. It has a custom unauthenticated `403` response.
No production POST, PATCH, or DELETE Department behavior was found.

The other direct Department-model read is
`modules/employee/infrastructure/persistence/employee-import.ts`, which loads
Department reference rows while preparing Employee imports. Employee queries
and reports also read `Employee.dept` through Employee-related queries, but
they do not provide Department lifecycle operations.

The current route-level Prisma access is a documented migration candidate. It
must not be copied into new architecture code; the target path remains:

```text
app route -> owner application/service -> owner repository/infrastructure -> Prisma
```

### B3. The three similarly named Employee concepts are not interchangeable

| Value | Current meaning | Evidence and boundary |
| --- | --- | --- |
| `Employee.departmentId` / `Employee.dept` | Required live association to the canonical Department row. | Prisma FK, Employee create/edit schemas and queries, Employee forms, import, list, stats, and export. Employee owns the association and its current form/import behavior; it does not own the Department entity lifecycle. |
| `Employee.affiliation` / `สังกัด` | Optional Employee-owned free-text field, maximum 200 characters after schema normalization. | `modules/employee/schemas/employee.ts`, Employee form, CSV parser, search, table/card, and export. No FK, lookup, authorization, or Organization relation uses it. Its business meaning is unresolved. |
| `Employee.managerId` | Nullable Employee-to-Employee reporting hierarchy. | Self-FK in Prisma, Employee hierarchy contract, Leave approver assignment, subordinate lookup, and offboarding blockers. It is not a Department head field and is not derived from `departmentId`. |

Leave stores `approverId` as the approver selected from the Employee's
`managerId` at request time. `exceptionApproverId` is a separate exception-flow
actor. Neither field proves a Department-head concept. Generic Employee update
does not accept `managerId`; Leave's approver-assignment use case owns the
Leave-specific policy and calls the public Employee hierarchy mutation.

The repository contains no Department-head entity, field, route, or explicit
“head of department” rule. A manager may be called a “หัวหน้า” in Leave UI and
notifications, but that is the Employee reporting/approval relationship, not
Department ownership.

### B4. Employee presentation and compatibility behavior

Employee create/edit forms fetch `/api/departments` and submit a required
numeric `departmentId`. The CSV flow accepts Department-like headers and the
current compatibility map recognizes only:

```text
ADMIN / บริหาร       -> ADMIN
ACADEMIC / วิชาการ    -> ACADEMIC
```

The import is Employee-owned, requires a Department code, and can return
partial success. Employee list/search/export projections join the live
Department name. Employee stats retain the two code-specific counters
`ADMIN` and `ACADEMIC`.

`modules/employee/presentation/dashboard/formatters.ts` contains the
historical two-way display mapping used by the import preview and badge style.
That mapping is presentation compatibility, not a proven Department invariant;
it can render an unknown code through the current fallback. It must not be
promoted into a general Organization/Department rule without a product
decision.

### B5. Leave, Routine, Stock, and other consumers

- Leave selects Department ID/name as part of Employee projections for approval
  lists, approver management, participant access, reports, exports, and LIFF
  serialization. It displays or sorts by the live Department name; it does not
  authorize by Department or mutate Department. Leave's real policy dependency
  is Employee hierarchy and Leave approval state.
- Routine reference and import-staging data carries Employee `departmentId`.
  The current Routine code does not use it to authorize, filter, or assign a
  task. Routine's Thai `หน่วยงาน` UI is its own `RoutineUnit` capability and
  must not be confused with Department or Organization.
- No meaningful production Department/Organization consumer was found in
  `modules/stock/**`. Stock uses User/Employee display and requester/issuer
  projections, not Department policy.
- `lib/audit-log/` can label or record `departmentId` as Employee operation
  metadata, but it does not resolve Department lifecycle or enforce membership.

### B6. Email Request is not a Department relation

`EmailRequest.department` is a required `String` with no FK, relation, or
Department index. The Email Request form calls the field `สังกัด`, accepts
requester-entered text such as `มสช. สพบ.`, and does not load
`/api/departments`. The value is persisted and later shown in history,
notifications, LINE messages, and audit/request payloads.

The correct current classification is **requester-provided free text with
historical snapshot behavior**, not a live Department reference. It must not
be normalized into `departmentId` merely because the Department table exists.

### B7. Auth, identity, membership, and authorization

The current concepts are separate:

| Concept | Current repository evidence |
| --- | --- |
| Identity | `User` identity and the optional one-to-one `User.employeeId` link; Employee email is globally unique. |
| Authentication/session | `lib/auth/server.ts` checks active User, linked Employee, lifecycle, and session/token state. |
| Role/authorization | `User.role`, API/admin guards, Dashboard route access, and Leave capability checks. |
| Employee/workforce membership | A linked active Employee is required for normal workforce access; this is not an Organization membership table. |
| Department membership | `Employee.departmentId` is used for data/display and required persistence, not authorization. |
| Organization membership | No model, join table, ID, session scope, switcher, tenant predicate, or authorization rule exists. |

Auth projects `employee.dept.name` into the session as `user.department` for
display. Dashboard navbar/home and `AuthStatus` display it; no auth helper,
role check, API guard, or route-access rule uses it to grant or deny access.
The current `@thainhf.org` signup/domain rule is an email-domain restriction,
not an Organization entity or membership implementation.

### B8. Organization discovery result

Repository-wide searches across schema, migrations, seed, application code,
routes, configuration, session types, and UI found no implemented
`Organization`, `organizationId`, `orgId`, `tenantId`, or equivalent
persistence/domain boundary. Git history for schema, migrations, and seed also
shows no established Organization/tenant model.

The application nevertheless has an **implicit single-organization/product
assumption**:

- `PRODUCT.md`, `README.md`, and the landing page describe one internal NHF
  product rather than a SaaS/public multi-tenant service;
- signup and Employee rules enforce `@thainhf.org`, and bootstrap data defaults
  to `admin@thainhf.org`;
- one MySQL database/deployment configuration is used, with no tenant context;
- Department name/code, Employee email, and User email are globally unique;
- current queries across Employee, Leave, Routine, Stock, Auth, audit, and
  notifications have no tenant predicates; and
- there is no organization switching URL, session claim, middleware, RLS, or
  organization-scoped storage layout.

This establishes an implicit single-NHF deployment assumption, not a formal
Organization domain invariant. The repository cannot determine whether the
product should support multiple organizations in one database, multiple
memberships, or organization switching. Those are product requirements, not
safe deductions from the word `organization` in UI copy or `affiliation`.

## C. Consumer inventory

The table includes production consumers and distinguishes canonical Department
data from Employee projections, free text, and unrelated “หน่วยงาน” values.
Test fixtures and migration evidence are described after the table rather than
being counted as runtime consumers.

| Consumer/path | Current dependency | Behavior | Current owner | Target owner/interface | Migration phase |
| --- | --- | --- | --- | --- | --- |
| `app/api/departments/route.ts` | `prisma.department` | Authenticated GET; direct `findMany`, `name asc`, `{ departments }`, custom 403 when unauthenticated; no writes. | `app` delivery plus transitional Department capability | App route remains delivery; call the future reference-data owner server contract. | G1 |
| `modules/employee/infrastructure/persistence/employee-import.ts` | Direct Department lookup | Loads reference rows by code/name while preparing Employee import data. | Employee infrastructure, with transitional direct access | Employee keeps import mapping; Department reference validation/lookup comes through the future owner contract or an explicitly documented adapter. | G1 |
| `app/api/employees/**`, `modules/employee/schemas/employee.ts`, `modules/employee/application/mutations.ts` | Required `departmentId` | Create/update validates and persists Employee association; no Department lifecycle mutation. | Employee | Employee owns association/use-case semantics; future reference owner owns Department validity/lifecycle. | G1, then G3 re-audit |
| `modules/employee/infrastructure/persistence/employee-queries.ts` and `modules/employee/infrastructure/export/employee-export.ts` | `Employee.dept` relation | List/search/stats/export use live Department ID/code/name; stats retain ADMIN/ACADEMIC compatibility counters. | Employee | Employee-owned projection; use only a narrow owner contract if direct Department access must be removed. | G1/G3 |
| `modules/employee/presentation/dashboard/add-employee/useAddEmployee.ts`, `edit-employee/useEditEmployee.ts`, `shared/EmployeeFormFields.tsx` | `/api/departments` browser response | Loads options and submits `departmentId`; Department selector is presentation input, not a permission boundary. | Employee presentation plus app API | Preserve the endpoint; optionally consume an owner `client.ts` reference contract in G2 if the implementation needs it. | G2 |
| `modules/employee/presentation/import/*`, `modules/employee/application/import-employees.ts` | Textual Department code/name mapping | Accepts legacy aliases; only ADMIN/ACADEMIC are currently accepted; import remains Employee-owned. | Employee | Employee parser/mapping stays local; owner supplies only validated reference data. | G2/G3 |
| `lib/auth/server.ts`, `lib/auth/types.ts`, `app/api/auth/me/route.ts`, `components/auth/*`, Dashboard navbar/home | `Employee.dept.name` projection | Places Department name in session/user display; no Department-based authorization. | Auth/session composition and Dashboard presentation | Keep display projection in Auth/Employee composition; no Organization contract until requirements exist. | G3 re-audit |
| `modules/leave/application/approvals/*`, `application/queries/participant-access.ts`, `infrastructure/reports/*`, `server/liff-serialization.ts`, Leave presentation | Employee `departmentId`/`dept.name` projection | Displays/sorts Department labels in approval lists, reports, exports, and LIFF; policy is manager/Leave state, not Department. | Leave | Keep Leave dependent on a narrow Employee/reference projection, not Department internals. | G3 re-audit |
| `modules/routine/application/queries.ts`, `application/imports/staging.ts`, `schemas/import-reference.ts`, Routine presentation types | Employee `departmentId` carried in reference DTOs | Transports Employee data for Routine/import compatibility; no current Department filter, assignment, or authorization. | Routine | Keep the ID as an opaque Employee projection until a proven rule requires more. | G3 re-audit |
| `modules/stock/**` | None found | Stock uses User/Employee requester/issuer/display projections; no Department rule or query was found. | Stock | No Organization/Department dependency to introduce speculatively. | No migration; verify in G3 |
| `app/api/email-request/route.ts`, `lib/validations/email-request.ts`, `lib/services/email-request/*`, `components/email/*`, `lib/line/flex-messages/email-request.ts` | `EmailRequest.department: String` | Stores and redisplays requester-entered `สังกัด` text as a historical request value. | Email Request/application plus delivery integrations | Preserve as a snapshot/free-text field unless a separate product decision changes the request contract. | No normalization in G1-G3 |
| `lib/audit-log/*` and Employee route audit payloads | `departmentId` metadata/label | Records operation context or display labels; does not resolve or authorize Department. | Shared audit platform / source feature | Keep historical audit semantics; assess organization scoping only in a later tenant phase. | G3 re-audit |

Supporting non-runtime evidence includes Department creation in `prisma/seed.ts`,
Department/Employee fixtures in Employee, Leave, Routine, and integration
tests, and the Department FK cleanup order in those tests. These confirm the
required relation and deletion constraint but do not establish a production
Department administration workflow.

## D. Ownership matrix

| Capability | Current owner | Target owner | Rationale |
| --- | --- | --- | --- |
| Organization entity and lifecycle | None; no entity exists | Product decision first; if Organization and Department share scope/lifecycle, a future `modules/organization/` reference-data capability | The repository cannot prove an Organization aggregate or membership model. |
| Department entity/reference-data lifecycle | Transitional Prisma model plus `app/api/departments/route.ts`; no module | Conditional future organization/reference-data owner; remain transitional until G1 is approved | Department has reference shape but no independent lifecycle workflow. |
| Department name/code/description | Prisma constraints and seed; no business service | Future Department/Organization owner | Current `name` and `code` are globally unique; any scope change requires product and data decisions. |
| Department hierarchy | None | None until explicitly required; then owner of Department structure | No parent/ancestor data or behavior exists. |
| Department head | None | None until explicitly required; do not substitute `managerId` | Current “หัวหน้า” behavior is Employee manager/Leave approver behavior. |
| Organization ↔ Department relationship | None | Future Organization/Department owner if Organization is approved | No relationship or cardinality is currently persisted. |
| Employee ↔ Department association | Employee (`departmentId`, form/import/update behavior) | Employee continues to own the association; future reference owner owns entity validity | The association affects Employee use cases, but Employee must not absorb Department lifecycle. |
| Employee affiliation (`สังกัด`) | Employee free-text field | Employee unless product resolves it as another reference concept | No relation or behavior proves it is Organization membership. |
| Employee manager hierarchy | Employee (`managerId`, subordinate relation, hierarchy contract) | Employee | It is a durable reporting relationship and is already a completed Employee/Leave seam. |
| Leave approver meaning | Leave interprets `managerId` and owns approval/exception policy | Leave | `approverId` and `exceptionApproverId` are Leave request state, not Department structure. |
| Department lookup/reference projection | Transitional route and Employee import access | Future owner server contract; app remains delivery/composition | The route should preserve its URL/response while its data access moves behind the owner. |
| Employee/Leave/Auth display projections | Employee, Leave, and Auth respectively | Each consuming feature keeps its presentation projection | A display consumer does not become owner of the reference entity. |
| Email Request department text | Email Request | Email Request | It is requester-entered historical text, not canonical Department data. |

## E. Boundary decision (G0 historical record)

### Selected G0 boundary: D for the current repository

**Department remains transitional reference data for now.** G0 creates no
`modules/organization/` or `modules/department/`, does not move the route, and
does not alter the schema. Employee owns its required association and
Employee-specific mapping/projection behavior; it does not own Department
reference-data lifecycle.

### Conditional future target recorded by G0 (superseded)

If product requirements establish that there is a real Organization aggregate
and that Departments are scoped reference data beneath it, the recommended
future boundary is one `modules/organization/` capability owning Organization
and Department together. That is the most cohesive option for shared scope,
uniqueness, membership, and lifecycle rules. It is a future recommendation,
not an assertion that Organization exists today.

The earlier Employee migration phrase “future organization/reference-data
capability” is retained and made explicit here: it describes this conditional
owner, not an implementation or a mandate to add tenant fields now.

Rejected alternatives for the current evidence:

- **A immediately** is premature because Organization identity, membership,
  cardinality, scope, and authorization semantics are not established.
- **B, an independent Department module**, assumes a Department lifecycle that
  the repository does not have and would make later Organization scoping and
  uniqueness harder to reconcile.
- **C, separate Organization and Department modules**, creates two public
  boundaries without evidence that their workflows change independently. It
  should be reconsidered only if product requirements prove separate
  lifecycles, permissions, or integrations.
- **D now** is the smallest evidence-backed boundary: preserve the live
  Department FK and current endpoint while preventing Employee from becoming a
  de facto Department module.

## F. Public contract candidates

These are contract capabilities derived from current consumers, not APIs to
implement during G0.

### Server contract

1. A Department reference-list query, conceptually
   `listDepartmentReferences()`, is proven by the existing GET route, Employee
   selectors, and import preparation. Its minimum semantic data is `id` and
   `name`; Employee import also needs the current `code` mapping. The existing
   browser response shape must remain compatible while the owner is migrated.
2. Employee create/update/import needs a server-side way to validate or resolve
   a Department identifier/code inside its existing transactional behavior.
   The exact function shape is intentionally deferred to G1; no standalone
   `getDepartmentById()` or `resolveDepartmentByCode()` consumer is currently
   proven outside that use case.
3. No Department write contract is currently required by a production caller.
   A create/update/archive API must not be invented until lifecycle
   requirements are known.

### Client-safe contract

The current browser contract is the URL `/api/departments`, not a module client
entry. G0 therefore does not establish that a client-safe module API is
required immediately. If G2 moves the lookup/presentation boundary into the
future owner, its client-safe surface may expose only a small reference DTO
and lookup adapter; it must not expose Prisma, repositories, secrets, or
server-only Next.js APIs.

### Cross-module contract

The only future cross-module seam proven by current behavior is Employee's
Department association/reference validation. Leave, Routine, Stock, Auth, and
Dashboard currently need projections or Employee contracts, not Department
internals. They must not deep-import a future Department repository or Prisma
model. The existing Employee ↔ Leave hierarchy direction remains unchanged.

## G. Compatibility ledger

Later phases must preserve or explicitly approve changes to the following:

| Existing behavior/data | Compatibility requirement |
| --- | --- |
| `GET /api/departments` | Preserve URL, authenticated access behavior, `{ departments }` response, ascending name order, and existing IDs/fields unless a versioned contract is approved. |
| Employee add/edit selectors | Preserve loading from the Department endpoint and required `departmentId` submission semantics. |
| Employee create/edit API | Preserve Department FK validity, status/error behavior, and Employee association updates. |
| Employee CSV import | Preserve accepted headers, ADMIN/บริหาร and ACADEMIC/วิชาการ compatibility mapping, required Department behavior, and partial-success semantics. |
| Employee list/stats/export/display | Preserve live Department labels, search behavior, Thai column labels, and existing ADMIN/ACADEMIC counters until separately redesigned. |
| Auth/session/Dashboard | Preserve `user.department` display projection; do not silently turn it into authorization or membership. |
| Leave approvals/reports/LIFF | Preserve Department labels/projections and existing manager/approver policy; do not replace `managerId` with Department head semantics. |
| Routine reference/import DTOs | Preserve the carried Employee `departmentId` field while it remains part of current contracts. |
| `EmailRequest.department` | Preserve the stored free-text/snapshot string across API, UI history, audit, email, and LINE flows. Do not normalize implicitly. |
| Schema IDs and FK behavior | Preserve Department IDs, globally unique name/code behavior, required Employee FK, restrictive Department deletion, and existing historical Employee/Leave/Routine references until an approved migration changes them. |
| Employee offboarding | Preserve soft-delete behavior; do not physically remove Department references as a side effect. |

## H. Organization / multi-organization blast-radius map (G0 historical record)

No item in this section was implemented by G0. It is the historical impact map
that was recorded for a possible Organization requirement; the post-G0 product
decision makes that requirement permanently out of scope.

| Area | Existing assumption | Future decision/impact |
| --- | --- | --- |
| Organization and Department schema | No Organization table or relation; Department is global. | Define Organization identity, Department ownership/cardinality, migration of existing rows, and whether Department name/code become unique per Organization. |
| Department lifecycle | No status/archive/head/hierarchy. | Define rename, archive, delete, reassignment, historical labels, hierarchy, and head semantics before changing FK behavior. |
| Employee membership | One required Department ID; one global Employee email; free-text affiliation. | Decide whether Employee belongs to one or many Organizations, whether movement is historical, what affiliation means, and whether cross-organization managers are forbidden. |
| User identity and signup | User/Employee email is globally unique; `@thainhf.org` is enforced; no membership table. | Decide global identity versus organization membership, invitation/signup rules, scoped roles, organization switching, session current-organization context, and account deactivation. |
| Authorization/session | Role/admin and active workforce checks have no Organization scope; Department does not authorize. | Add server-side scope checks only after a requirements-backed model; audit every API and capability decision. |
| Employee queries and APIs | Queries have no tenant predicates; direct legacy Prisma remains in some paths. | Add scope to every read/write and public contract, including uniqueness, pagination, caching, and audit semantics. |
| Leave | Approvers, manager hierarchy, requests, reports, and exception flows use Employee IDs and live Employee/Department projections. | Enforce same-organization relationships, preserve historical approver/request meaning, and decide whether reports show current or historical Department labels. |
| Routine | Assignees and notification/reference queries use Employee IDs and carried `departmentId`. | Scope assignments, import reference data, scheduled jobs, and recipient resolution; prevent cross-organization assignment. |
| Stock | Requester/issuer and notification flows use User/Employee projections without Department scope. | Audit all stock ownership, requests, reports, and notification recipients for organization isolation if required. |
| Notifications/outbox/LINE/email | Delivery uses user identities and feature payloads; no organization scope. | Decide event keys, recipient scope, templates, and retry/idempotency behavior under organization separation. |
| Audit logs | Historical events contain actor/entity details and some Department IDs/labels without tenant scope. | Add reliable organization attribution and retention/query rules without rewriting historical meaning blindly. |
| Uploads and storage | Existing flows are not organization-scoped. | Define storage path, access checks, retention, and cross-organization isolation. |
| Reports/exports/UI | Reports and Dashboard have no organization selector or switcher. | Define URLs, filters, cached results, exports, and organization switching only if required. |

The blast radius is intentionally a map, not permission to add
`organizationId`, tenant middleware, RLS, switching, or new constraints.

## I. Open requirements / unresolved semantics (G0 historical snapshot)

The repository cannot answer these questions safely:

1. Is NHF permanently one organization per deployment, or must one application
   and database support multiple Organizations?
2. If multiple Organizations are required, can one User or Employee belong to
   multiple Organizations, and is organization switching needed?
3. Does Employee `affiliation` / `สังกัด` mean an Organization, an affiliate,
   a branch/unit, or intentionally remain free text?
4. Should Department `name` and `code` remain globally unique, or be unique
   only within an Organization?
5. Are nested Departments, Department archive/rename history, or a formal
   Department head required?
6. If a Department head is required, is it distinct from the Employee
   `managerId`/Leave approver relationship?
7. Is Department ever intended to affect authorization, or is it only
   reference/display/report data?
8. Should Email Request `สังกัด` remain requester-entered historical text, or
   should a future product flow select a canonical reference?
9. Is the two-code Employee import mapping a temporary compatibility rule or
   the complete supported Department vocabulary?
10. What historical behavior is required when an Employee changes Department
    or a Department is renamed, archived, or merged?

These questions must be answered before any Organization persistence,
tenant-scoped uniqueness, membership model, or Department lifecycle migration.

The list above records what was unresolved when G0 closed. Post-G0 resolves the
organization questions permanently: NHF Employee remains single-NHF-
organization, Department remains globally unique, and no Organization/tenant
architecture will be added. The remaining Department lifecycle questions are
outside G1 and do not create a future Organization branch.

## J. Proposed G1/G2/G3 plan (G0 historical plan)

G0 does not execute these phases.

### G1 — server/domain/persistence ownership

1. Resolve the minimum product questions above, starting with single versus
   multi-organization scope and the meaning of `affiliation`.
2. If the answer remains single-organization, implement only the smallest
   Department reference-data ownership needed by current behavior; do not add
   Organization or tenant columns.
3. Introduce the approved owner application/service and repository boundary,
   then route `GET /api/departments` through it while preserving URL, auth,
   response shape, ordering, and IDs.
4. Replace the Employee import's direct Department lookup with the narrow
   approved server contract or a documented transaction-safe adapter. Keep
   Employee's import mapping and association semantics in Employee.
5. Add characterization/integration coverage for Department lookup, FK
   validity, route compatibility, and import behavior before removing any
   transitional access. Do not add Department writes unless lifecycle
   requirements demand them.

### G2 — presentation/client ownership

1. Trace the actual G1 server contract into Employee add/edit and import
   presentation.
2. If an owner module needs client presentation, add only a client-safe
   reference DTO/adapter; keep Prisma, repositories, secrets, and server-only
   code unreachable from the client graph.
3. Preserve Employee selectors, Thai labels, import aliases, validation errors,
   and current browser endpoint behavior unless separately approved.
4. Re-audit Auth, Dashboard, Leave, and Routine projections so they consume
   narrow contracts rather than Department internals. Keep Email Request text
   unchanged.

### G3 — compatibility cleanup and final re-audit

1. Remove only Department transitional reads proven obsolete by G1/G2; do not
   rewrite unrelated legacy Prisma paths.
2. Re-run the repository-wide consumer search and compare it with Section C.
3. Verify route/API/schema/ID/FK compatibility, Employee/Leave hierarchy
   direction, Routine/Stock absence of accidental dependencies, snapshot
   fields, and Thai text/encoding.
4. Run the architecture checker if module code or enforcement-relevant paths
   are changed, and close the migration only with a final diff and runtime
   consumer audit.

## K. Non-goals completed by not doing them (G0 historical record)

G0 deliberately did not:

- create `modules/organization/` or `modules/department/`;
- move `/api/departments` or Department Prisma access;
- change Employee, Leave, Routine, Stock, Auth, session, or Dashboard runtime;
- add Organization/tenant models, IDs, middleware, RLS, switching, or
  migrations;
- alter seed data, uniqueness/FK constraints, Department hierarchy, or heads;
- normalize free-text `department` values into foreign keys; or
- perform unrelated cleanup.

## L. Phase G1 implementation record

Phase G1 establishes `modules/department/` as the server-side Department
ownership boundary without changing the Department schema or redesigning the
capability.

```text
app/api/departments/route.ts
    -> @/modules/department
        -> modules/department/application/queries.ts
            -> modules/department/infrastructure/persistence/
                -> lib/db/prisma -> Department

modules/employee/application/import-employees.ts
    -> @/modules/department
        .listDepartmentReferences()
```

The supported server entry point is `modules/department/index.ts`. It exposes
only these consumer-driven contracts:

| Contract | Consumer | Responsibility |
| --- | --- | --- |
| `listDepartments()` | `app/api/departments/route.ts` | Returns all current scalar Department fields, ordered by `name` ascending. |
| `listDepartmentReferences()` | `modules/employee/application/import-employees.ts` | Returns only `{ id, code }` reference data required by the existing import mapping. |

Department infrastructure is the only production owner of
`prisma.department` reads. Employee persistence retains Employee identity
lookup and Employee creation, including the `dept.name` result needed for the
existing import response, but no longer reads the Department model directly.
Employee continues to own CSV parsing, aliases, the `ADMIN`/`บริหาร` and
`ACADEMIC`/`วิชาการ` mapping, validation messages, partial-success behavior,
duplicate handling, temporary email generation, status mapping, and
`departmentId` association semantics.

`GET /api/departments` remains an app delivery boundary. Its authentication,
custom unauthenticated `403`, `{ departments }` response, full scalar field
compatibility, ascending name order, Department IDs, and sanitized `500`
failure behavior are unchanged. Authentication remains outside the Department
module, and Department application code does not depend on Next.js delivery
objects or Employee.

No `modules/department/client.ts`, Department CRUD, lifecycle, archive,
hierarchy, or Department-head behavior was introduced. `Employee.affiliation`
remains free text, `Employee.managerId` remains Employee hierarchy used by
Leave, and `EmailRequest.department` remains requester-provided historical
free text. Leave, Routine, Stock, Auth, Dashboard, seed data, migrations,
schema constraints, Department IDs, and foreign-key behavior remain outside
this ownership migration.

The architecture checker now protects the migrated boundary by requiring
Department API routes to use `@/modules/department`, rejecting direct
`prisma.department` access outside Department infrastructure (while allowing
tests and Prisma support code), and rejecting Department-to-Employee runtime
dependencies. The generic public-entry rule continues to reject all other
external and cross-module Department deep imports.

## M. Historical Phase G2 proposal — Department client/presentation boundary

The smallest evidence-backed G2 scope is a presentation re-audit only:

1. Trace the existing Employee selectors and import UI through the unchanged
   `/api/departments` browser contract.
2. Add a Department client-safe entry only if a Department-owned presentation
   component or browser adapter is proven necessary.
3. Keep Employee's selector, import aliases, Thai labels, and validation
   behavior Employee-owned unless a separate product requirement changes them.

Current evidence does not require Department-owned client presentation, so G2
should not create `modules/department/client.ts` artificially or move Employee
presentation. Organization and tenant work remain permanently out of scope.

## N. Phase G2 implementation and presentation re-audit record

Phase G2 is closed. The repository-wide presentation audit confirms that
Department is intentionally server-only:

```text
modules/department/index.ts
    = server-only Department public API

Employee client
    -> GET /api/departments
        -> app/api/departments/route.ts
            -> @/modules/department
```

No production Department-owned client or standalone presentation contract was
found. The audited ownership classifications are:

| Consumer | Classification and owner |
| --- | --- |
| Employee add/edit selectors, `departmentId` state, and form validation | Employee-owned presentation consuming the HTTP response |
| Employee import CSV aliases, mapping, preview, and result display | Employee-owned presentation/application behavior |
| Employee table/card labels and `getEmployeeDepartmentLabel` / `getEmployeeDepartmentBadgeClass` | Employee-owned compatibility presentation; historical fallback behavior is preserved |
| Auth/Dashboard `user.department` | Auth/session projection and Dashboard display; not Department authorization |
| Leave Department IDs/names | Leave-owned Employee projections for reports, approvals, and LIFF; no Department internals |
| Routine `departmentId` | Opaque Employee projection; `RoutineUnit` remains a separate Routine concept |
| Stock | No Department presentation or dependency found |
| Email Request `department` / `สังกัด` | Email Request free-text/snapshot behavior, unrelated to canonical Department |

The existing `GET /api/departments` endpoint remains the browser contract. The
Employee selectors continue to use `API_ROUTES.employees.departments`; that
namespace is retained as compatibility naming because changing it would add
no behavior or ownership benefit. No server action, direct client module
import, new route, or response change was introduced.

The architecture checker now rejects both direct and transitive runtime imports
of `@/modules/department` from production Client Component graphs. It permits
the existing app route and Employee application server consumers, and does not
classify HTTP access through `/api/departments` or the route constant as a
module dependency. The Department diagnostic directs browser code to the
existing HTTP/API boundary and does not suggest a nonexistent client entry.

No `modules/department/client.ts` exists or is required. No Department UI,
schema, migration, seed, authorization, Organization, tenant, or runtime
business behavior was added or changed.

### Proposed Phase G3 scope

Phase G3 should perform final ownership verification, remove only obsolete
Department compatibility artifacts proven unnecessary, reconcile architecture
documentation and migration ledgers, and close the migration with a final
consumer/dependency audit. It should not introduce Department presentation,
Organization/tenant concepts, schema changes, or unrelated runtime cleanup.

